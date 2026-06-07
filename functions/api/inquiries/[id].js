// Cloudflare Pages Function: /api/inquiries/:id
// 处理单个询价单据的查询、修改、删除

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  const id = params.id;
  const method = request.method;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  try {
    // ----- GET: 获取单个单据（含附件） -----
    if (method === 'GET') {
      const record = await db.prepare('SELECT * FROM inquiries WHERE id = ?').bind(id).first();
      if (!record) {
        return new Response(JSON.stringify({ error: '记录不存在' }), { headers, status: 404 });
      }

      const { results: atts } = await db.prepare(
        'SELECT fid, file_name, file_type, file_data FROM attachments WHERE inquiry_id = ?'
      ).bind(id).all();

      record.fileIds = atts.map(a => a.fid);
      record._attachments = atts;

      return new Response(JSON.stringify(record), { headers });
    }

    // ----- PUT: 修改单据 -----
    if (method === 'PUT') {
      const body = await request.json();
      const { supplier, goods, num, price, totalPrice, askDate, remark, files } = body;

      const existing = await db.prepare('SELECT * FROM inquiries WHERE id = ?').bind(id).first();
      if (!existing) {
        return new Response(JSON.stringify({ error: '记录不存在' }), { headers, status: 404 });
      }

      await db.prepare(
        `UPDATE inquiries 
         SET supplier = ?, goods = ?, num = ?, price = ?, total_price = ?, ask_date = ?, remark = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).bind(
        supplier || existing.supplier,
        goods || existing.goods,
        num !== undefined ? num : existing.num,
        price !== undefined ? price : existing.price,
        totalPrice !== undefined ? totalPrice : existing.total_price,
        askDate || existing.ask_date,
        remark !== undefined ? remark : existing.remark,
        id
      ).run();

      // 处理附件：如果传了 files，先删旧附件再插入新的
      const fileIds = [];
      if (files && Array.isArray(files)) {
        await db.prepare('DELETE FROM attachments WHERE inquiry_id = ?').bind(id).run();
        for (const f of files) {
          const fid = f.fid || (Date.now().toString(36) + Math.random().toString(36).slice(2));
          await db.prepare(
            'INSERT INTO attachments (fid, inquiry_id, file_name, file_type, file_data) VALUES (?, ?, ?, ?, ?)'
          ).bind(fid, id, f.name, f.type, f.data || '').run();
          fileIds.push(fid);
        }
      }

      return new Response(JSON.stringify({ success: true, fileIds }), { headers });
    }

    // ----- DELETE: 删除单据（级联删除附件） -----
    if (method === 'DELETE') {
      const existing = await db.prepare('SELECT * FROM inquiries WHERE id = ?').bind(id).first();
      if (!existing) {
        return new Response(JSON.stringify({ error: '记录不存在' }), { headers, status: 404 });
      }

      await db.prepare('DELETE FROM attachments WHERE inquiry_id = ?').bind(id).run();
      await db.prepare('DELETE FROM inquiries WHERE id = ?').bind(id).run();

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers, status: 405
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers, status: 500
    });
  }
}
