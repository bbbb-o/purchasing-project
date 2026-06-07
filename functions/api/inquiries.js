// Cloudflare Pages Function: /api/inquiries
// 处理询价单据的列表查询和新增

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const method = request.method;

  // 设置 CORS 头
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  try {
    // ----- GET: 获取所有询价单据 -----
    if (method === 'GET') {
      const search = url.searchParams.get('search') || '';
      let query = 'SELECT * FROM inquiries';
      let params = [];

      if (search) {
        query += ' WHERE xj_no LIKE ? OR supplier LIKE ? OR goods LIKE ? OR remark LIKE ?';
        const s = `%${search}%`;
        params = [s, s, s, s];
      }

      query += ' ORDER BY id DESC';
      const { results } = await db.prepare(query).bind(...params).all();

      // 获取每个单据的附件数量
      for (const row of results) {
        const { results: atts } = await db.prepare(
          'SELECT fid, file_name, file_type FROM attachments WHERE inquiry_id = ?'
        ).bind(row.id).all();
        row.fileIds = atts.map(a => a.fid);
        row._attachments = atts;
      }

      return new Response(JSON.stringify(results), { headers });
    }

    // ----- POST: 新增询价单据 -----
    if (method === 'POST') {
      const body = await request.json();
      const { xjNo, supplier, goods, num, price, totalPrice, askDate, remark, files } = body;

      // 必填字段校验
      if (!xjNo || !supplier || !goods || !askDate) {
        return new Response(JSON.stringify({ error: '供应商、产品名称、询价日期为必填项' }), {
          headers, status: 400
        });
      }

      // 检查单号是否重复
      const existing = await db.prepare('SELECT id FROM inquiries WHERE xj_no = ?').bind(xjNo).first();
      if (existing) {
        return new Response(JSON.stringify({ error: '询价单号已存在' }), {
          headers, status: 409
        });
      }

      // 插入询价记录
      const result = await db.prepare(
        `INSERT INTO inquiries (xj_no, supplier, goods, num, price, total_price, ask_date, remark) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(xjNo, supplier, goods, num || null, price || null, totalPrice || null, askDate, remark || '').run();

      const inquiryId = result.meta.last_row_id;

      // 插入附件
      const fileIds = [];
      if (files && Array.isArray(files)) {
        for (const f of files) {
          const fid = f.fid || (Date.now().toString(36) + Math.random().toString(36).slice(2));
          await db.prepare(
            'INSERT INTO attachments (fid, inquiry_id, file_name, file_type, file_data) VALUES (?, ?, ?, ?, ?)'
          ).bind(fid, inquiryId, f.name, f.type, f.data || '').run();
          fileIds.push(fid);
        }
      }

      const newRecord = {
        id: inquiryId,
        xj_no: xjNo,
        supplier, goods, num, price, total_price: totalPrice,
        ask_date: askDate, remark: remark || '',
        fileIds
      };

      return new Response(JSON.stringify(newRecord), { headers, status: 201 });
    }

    // 不支持的请求方法
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers, status: 405
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers, status: 500
    });
  }
}
