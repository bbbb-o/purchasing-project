// Cloudflare Pages Function: /api/download/:fid
// 提供附件下载服务（支持 iOS/手机浏览器）

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  const fid = params.fid;

  // CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Expose-Headers': 'Content-Disposition, Content-Type, Content-Length',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    // 查询附件
    const row = await db.prepare(
      'SELECT file_name, file_type, file_data FROM attachments WHERE fid = ?'
    ).bind(fid).first();

    if (!row) {
      return new Response(JSON.stringify({ error: '附件不存在' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const fileName = row.file_name || 'download';
    const mimeType = row.file_type || 'application/octet-stream';
    const base64Data = row.file_data || '';

    // base64 解码为二进制
    let binaryData;
    try {
      // Cloudflare Workers 支持 atob
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      binaryData = bytes;
    } catch (e) {
      // 解码失败，返回原始文本
      binaryData = new TextEncoder().encode(base64Data);
    }

    // 检查是否为内联预览模式（?inline=1）
    const url = new URL(request.url);
    const isInline = url.searchParams.get('inline') === '1';

    // 返回文件，带正确的下载头
    const headers = {
      ...corsHeaders,
      'Content-Type': mimeType,
      'Content-Length': String(binaryData.length),
    };

    // 只有非内联模式才加 attachment 强制下载
    if (!isInline) {
      headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(fileName)}"`;
    }

    return new Response(binaryData, { headers, status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: '下载失败: ' + err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}
