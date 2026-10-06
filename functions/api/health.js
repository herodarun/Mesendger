function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store'
        }
    });
}

export async function onRequestGet({ env }) {
    if (!env.DB) {
        return json({ ok: false, error: 'Не подключена база D1. Добавьте привязку с именем DB в настройках Cloudflare Pages.' }, 503);
    }

    try {
        await env.DB.prepare('SELECT code FROM rooms LIMIT 1').first();
        await env.DB.prepare('SELECT seq FROM messages LIMIT 1').first();
        return json({ ok: true });
    } catch (_) {
        return json({ ok: false, error: 'Таблицы чата не найдены. Выполните schema.sql в консоли базы D1.' }, 503);
    }
}
