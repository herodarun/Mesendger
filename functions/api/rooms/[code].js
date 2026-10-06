function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store'
        }
    });
}

export async function onRequestGet({ params, env }) {
    if (!env.DB) {
        return json({ error: 'Не подключена база D1. Добавьте привязку с именем DB в настройках Cloudflare Pages.' }, 503);
    }

    const code = String(params.code || '').toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
        return json({ error: 'Код комнаты должен состоять из шести букв или цифр.' }, 400);
    }

    try {
        const room = await env.DB
            .prepare('SELECT code, name, created_at FROM rooms WHERE code = ?')
            .bind(code)
            .first();

        if (!room) return json({ error: 'Комната не найдена.' }, 404);
        return json({ code: room.code, name: room.name, createdAt: Number(room.created_at) });
    } catch (error) {
        console.error('[api/rooms/:code] Ошибка чтения комнаты:', error);
        return json({ error: 'Не удалось прочитать комнату. Проверьте схему базы D1.' }, 500);
    }
}
