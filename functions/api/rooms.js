function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store'
        }
    });
}

function generateRoomCode() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export async function onRequestPost({ request, env }) {
    if (!env.DB) {
        return json({ error: 'Не подключена база D1. Добавьте привязку с именем DB в настройках Cloudflare Pages.' }, 503);
    }

    let body;
    try {
        body = await request.json();
    } catch (_) {
        return json({ error: 'Ожидался JSON с названием комнаты.' }, 400);
    }

    const requestedName = body && typeof body.name === 'string' ? body.name.trim() : '';
    const name = (requestedName || 'Комната').slice(0, 80);

    try {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const code = generateRoomCode();
            const createdAt = Date.now();
            const result = await env.DB
                .prepare('INSERT INTO rooms (code, name, created_at) VALUES (?, ?, ?) ON CONFLICT(code) DO NOTHING')
                .bind(code, name, createdAt)
                .run();

            if (result.meta?.changes === 0) continue;
            return json({ code, name, createdAt }, 201);
        }
        return json({ error: 'Не удалось подобрать свободный код комнаты. Попробуйте ещё раз.' }, 503);
    } catch (error) {
        console.error('[api/rooms] Ошибка создания комнаты:', error);
        return json({ error: 'Не удалось создать комнату. Проверьте настройки базы D1 и выполните schema.sql.' }, 500);
    }
}
