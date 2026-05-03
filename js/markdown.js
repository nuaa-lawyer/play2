// ============================================================
// 法简AI - 轻量 Markdown 渲染器
// 原生实现，零依赖，支持基础 Markdown 语法
// ============================================================

const Markdown = (function () {
  'use strict';

  /**
   * 将 Markdown 字符串渲染为 HTML
   * 支持的语法：标题、粗体、斜体、列表、代码块、行内代码、段落、换行
   */
  function render(md) {
    if (!md || typeof md !== 'string') return '';

    // 1. HTML 转义原始内容
    let html = Utils.escapeHTML(md);

    // 2. 代码块（```...```）—— 优先处理，防止内部语法被后续规则破坏
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, function (_, lang, code) {
      return '<pre><code class="' + (lang || '') + '">' + code.trim() + '</code></pre>';
    });

    // 3. 行内代码 `...`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 4. 粗体 **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 5. 斜体 *text*（不与粗体冲突）
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // 6. 标题 ### ...（三级在前，避免与一二级匹配冲突）
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

    // 7. 无序列表 - item
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    // 包裹连续 <li>
    html = html.replace(/(<li>.*<\/li>)\n?(<li>)/g, '$1$2');
    html = html.replace(/((?:<li>.*<\/li>)+)/g, '<ul>$1</ul>');

    // 8. 有序列表 1. item
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
    // 二次包裹有序（简单策略：在无 <ul> 包裹时处理）
    html = html.replace(/((?:<li>.*<\/li>)+)/g, function (match) {
      if (match.includes('<ul>')) return match;
      return '<ol>' + match + '</ol>';
    });

    // 9. 段落：连续非空行
    html = html.replace(/\n\n+/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // 10. 单行换行 → <br>
    html = html.replace(/\n/g, '<br>');

    // 11. 清理空段落
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p><br><\/p>/g, '');

    // 12. 宽泛清理：合并多余标签
    html = html.replace(/<p><(h[2-4]|ul|ol|pre|li)/g, '<$1');
    html = html.replace(/(<\/h[2-4]>|<\/ul>|<\/ol>|<\/pre>|<\/li>)<\/p>/g, '$1');

    return html;
  }

  // ---------- 公开 API ----------
  return Object.freeze({ render });
})();
