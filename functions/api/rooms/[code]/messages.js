function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store'
        }
    });
}

function normalizeCode(value) {
    const code = String(value || '').toUpperCase();
    return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

function serializeMessage(row) {
    return {
        seq: Number(row.seq),
        id: row.id,
        senderId: row.sender_id,
        text: row.text,
        createdAt: Number(row.created_at)
    };
}

async function roomExists(db, code) {
    return Boolean(await db.prepare('SELECT code FROM rooms WHERE code = ?').bind(code).first());
}

export async function onRequestGet({ request, params, env }) {
    if (!env.DB) {
        return json({ error: 'Не подключена база D1. Добавьте привязку с именем DB в настройках Cloudflare Pages.' }, 503);
    }

    const code = normalizeCode(params.code);
    if (!code) return json({ error: 'Некорректный код комнаты.' }, 400);

    const rawCursor = new URL(request.url).searchParams.get('after') || '0';
    if (!/^\d+$/.test(rawCursor)) return json({ error: 'Некорректный курсор сообщений.' }, 400);
    const after = Number(rawCursor);
    if (!Number.isSafeInteger(after)) return json({ error: 'Некорректный курсор сообщений.' }, 400);

    try {
        if (!await roomExists(env.DB, code)) return json({ error: 'Комната не найдена.' }, 404);

        const result = await env.DB
            .prepare('SELECT seq, id, sender_id, text, created_at FROM messages WHERE room_code = ? AND seq > ? ORDER BY seq ASC LIMIT 500')
            .bind(code, after)
            .all();
        const messages = (result.results || []).map(serializeMessage);
        const cursor = messages.length ? messages[messages.length - 1].seq : after;
        return json({ messages, cursor });
    } catch (error) {
        console.error('[api/rooms/:code/messages] Ошибка чтения сообщений:', error);
        return json({ error: 'Не удалось загрузить сообщения. Проверьте схему базы D1.' }, 500);
    }
}

export async function onRequestPost({ request, params, env }) {
    if (!env.DB) {
        return json({ error: 'Не подключена база D1. Добавьте привязку с именем DB в настройках Cloudflare Pages.' }, 503);
    }

    const code = normalizeCode(params.code);
    if (!code) return json({ error: 'Некорректный код комнаты.' }, 400);

    let body;
    try {
        body = await request.json();
    } catch (_) {
        return json({ error: 'Ожидался JSON с текстом сообщения.' }, 400);
    }

    const id = body && typeof body.id === 'string' ? body.id.trim() : '';
    const senderId = body && typeof body.senderId === 'string' ? body.senderId.trim() : '';
    const text = body && typeof body.text === 'string' ? body.text.trim() : '';
    if (!id || id.length > 128) return json({ error: 'Некорректный идентификатор сообщения.' }, 400);
    if (!senderId || senderId.length > 128) return json({ error: 'Некорректный идентификатор отправителя.' }, 400);
    if (!text || text.length > 4000) return json({ error: 'Сообщение должно содержать от 1 до 4000 символов.' }, 400);

    try {
        if (!await roomExists(env.DB, code)) return json({ error: 'Комната не найдена.' }, 404);

        const createdAt = Date.now();
        await env.DB
            .prepare('INSERT OR IGNORE INTO messages (id, room_code, sender_id, text, created_at) VALUES (?, ?, ?, ?, ?)')
            .bind(id, code, senderId, text, createdAt)
            .run();

        const row = await env.DB
            .prepare('SELECT seq, id, room_code, sender_id, text, created_at FROM messages WHERE id = ?')
            .bind(id)
            .first();
        if (!row) return json({ error: 'Не удалось сохранить сообщение.' }, 500);
        if (row.room_code !== code || row.sender_id !== senderId || row.text !== text) {
            return json({ error: 'Идентификатор сообщения уже используется.' }, 409);
        }

        return json({ message: serializeMessage(row) }, 201);
    } catch (error) {
        console.error('[api/rooms/:code/messages] Ошибка сохранения сообщения:', error);
        return json({ error: 'Не удалось сохранить сообщение. Проверьте схему базы D1.' }, 500);
    }
}
