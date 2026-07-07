/* ============================================================
   app.js — 周易摇卦交互逻辑
   ============================================================ */

// ── DOM 引用 ──
const tossArea = document.getElementById('tossArea');
const hexSection = document.getElementById('hexSection');
const origLines = document.getElementById('origLines');
const origName = document.getElementById('origName');
const origNameSub = document.getElementById('origNameSub');
const origDesc = document.getElementById('origDesc');
const changeLines = document.getElementById('changeLines');
const changeName = document.getElementById('changeName');
const changeNameSub = document.getElementById('changeNameSub');
const changeDesc = document.getElementById('changeDesc');
const reading = document.getElementById('reading');
const readingText = document.getElementById('readingText');
const castBtn = document.getElementById('castBtn');
const saveBtn = document.getElementById('saveBtn');
const shareBtn = document.getElementById('shareBtn');
const historyBtn = document.getElementById('historyBtn');
const historyPanel = document.getElementById('historyPanel');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const detailModal = document.getElementById('detailModal');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const modalSubtitle = document.getElementById('modalSubtitle');
const modalBody = document.getElementById('modalBody');

let isAnimating = false;
let lastResult = null;

// ── 工具函数 ──

/** 掷三枚铜钱，0=字(阴/2分), 1=花(阳/3分) */
function tossThree() {
  return [
    Math.random() < 0.5 ? 0 : 1,
    Math.random() < 0.5 ? 0 : 1,
    Math.random() < 0.5 ? 0 : 1
  ];
}

/** 计算一爻结果 */
function judge(coins) {
  const sum = coins.reduce((a,b)=>a+b, 0); // 0-3
  // 字=0(2分), 花=1(3分) → 6-9
  const score = coins.map(c=>c===0?2:3).reduce((a,b)=>a+b, 0);
  const isMoving = (score===6 || score===9);
  const value = (score===6||score===8) ? 0 : 1;
  const label = score===6 ? '老阴' : score===7 ? '少阳' : score===8 ? '少阴' : '老阳';
  const sub = score===6 ? '⚋ 变阳' : score===7 ? '⚊' : score===8 ? '⚋' : '⚊ 变阴';
  return { coins, score, value, moving: isMoving, label, sub };
}

/** 从爻位查卦 */
function lookup(bits) {
  const lower = 7 - bits.slice(0,3).reduce((acc,b,i)=>acc+(b<<i), 0);
  const upper = 7 - bits.slice(3,6).reduce((acc,b,i)=>acc+(b<<i), 0);
  const data = (HEX[upper] && HEX[upper][lower]) ? HEX[upper][lower] : null;
  return { upper, lower, data };
}

/** 全名：天火同人 / 乾为天 */
function getFullName(upper, lower) {
  const up = T_NATURE[upper];
  const lo = T_NATURE[lower];
  const data = HEX[upper]?.[lower];
  if (!data) return '未知';
  const n = data.name;
  if (upper === lower) return `${up}为${n}`;
  return `${up}${lo}${n}`;
}

/** 五行颜色 */
function getElementColor(nature) {
  const map = { '天':'#d4a843','泽':'#5b9bd5','火':'#e74c3c','雷':'#27ae60',
    '风':'#1abc9c','水':'#3498db','山':'#8b7355','地':'#b8956a' };
  return map[nature] || '#8888aa';
}

// ── 纳甲排盘 ──

/** 八卦三爻 [初爻, 二爻, 三爻]，0阴1阳 */
function trigramBits(idx) {
  const v = 7 - idx;
  return [v & 1, (v>>1) & 1, (v>>2) & 1];
}

/** 五行生克定六亲，返回 LIUQIN_NAMES 索引 */
function getLiuQin(selfWx, otherWx) {
  const SHENG = {0:2, 2:1, 1:3, 3:4, 4:0}; // 金生水→木→火→土→金
  const KE    = {0:1, 1:4, 4:2, 2:3, 3:0}; // 金克木→土→水→火→金
  if (selfWx === otherWx) return 1; // 兄弟
  if (SHENG[otherWx] === selfWx) return 0; // 父母（生我）
  if (SHENG[selfWx] === otherWx) return 4; // 子孙（我生）
  if (KE[otherWx] === selfWx) return 2; // 官鬼（克我）
  if (KE[selfWx] === otherWx) return 3; // 妻财（我克）
  return 1;
}

/** 纳甲排盘计算 */
function computeNayja(upper, lower) {
  const lb = trigramBits(lower), ub = trigramBits(upper);
  const lines = [lb[0], lb[1], lb[2], ub[0], ub[1], ub[2]];
  const not = x => 1 - x;

  for (let p = 0; p < 8; p++) {
    const t = trigramBits(p);
    const patterns = [
      {type:'八纯', t:[t[0],t[1],t[2],t[0],t[1],t[2]], shi:5, ying:2},
      {type:'一世', t:[not(t[0]),t[1],t[2],t[0],t[1],t[2]], shi:0, ying:3},
      {type:'二世', t:[not(t[0]),not(t[1]),t[2],t[0],t[1],t[2]], shi:1, ying:4},
      {type:'三世', t:[not(t[0]),not(t[1]),not(t[2]),t[0],t[1],t[2]], shi:2, ying:5},
      {type:'四世', t:[not(t[0]),not(t[1]),not(t[2]),not(t[0]),t[1],t[2]], shi:3, ying:0},
      {type:'五世', t:[not(t[0]),not(t[1]),not(t[2]),not(t[0]),not(t[1]),t[2]], shi:4, ying:1},
      {type:'游魂', t:[not(t[0]),not(t[1]),not(t[2]),t[0],not(t[1]),t[2]], shi:3, ying:0},
      {type:'归魂', t:[t[0],t[1],t[2],t[0],not(t[1]),t[2]], shi:2, ying:5},
    ];
    for (const pat of patterns) {
      if (pat.t.every((v,i) => v === lines[i])) {
        const dizhi = [...NAJIA_INNER[lower], ...NAJIA_OUTER[upper]];
        const wxMap = {'金':0,'木':1,'水':2,'火':3,'土':4};
        const selfWx = wxMap[T_WUXING[p]];
        const liuqin = dizhi.map(d => getLiuQin(selfWx, DIZHI_WUXING[d]));
        return {
          palace: p, palaceName: T_NAME[p], palaceIcon: T_ICON[p],
          palaceElement: T_WUXING[p], type: pat.type,
          shi: pat.shi, ying: pat.ying, dizhi, liuqin
        };
      }
    }
  }
  return null;
}

/** 分字配色 HTML */
function coloredNameHTML(name, upper, lower) {
  const up = T_NATURE[upper];
  const lo = T_NATURE[lower];
  const n = name;
  if (upper === lower) {
    return `<span style="color:${getElementColor(up)}">${up}</span><span>为</span><span style="color:${getElementColor(up)}">${n}</span>`;
  }
  return `<span style="color:${getElementColor(up)}">${up}</span><span style="color:${getElementColor(lo)}">${lo}</span><span style="color:${getElementColor(up)}">${n}</span>`;
}

/** 渲染卦爻 */
function renderHexagramColored(container, bits, moving, upper, lower) {
  container.innerHTML = '';
  const up = T_NATURE[upper];
  const lo = T_NATURE[lower];
  for (let i = bits.length - 1; i >= 0; i--) {
    const div = document.createElement('div');
    div.className = 'line ' + (bits[i] === 1 ? 'yang' : 'yin');
    if (moving[i]) div.classList.add('moving');
    const color = i >= 3 ? getElementColor(up) : getElementColor(lo);
    if (bits[i] === 1) div.style.background = color;
    container.appendChild(div);
  }
}

/** 设置卦名区 */
function setHexagramInfo(nameEl, subEl, descEl, data, upper, lower) {
  if (!data) {
    nameEl.innerHTML = '未知';
    subEl.textContent = '';
    descEl.textContent = '';
    return;
  }
  nameEl.innerHTML = coloredNameHTML(data.name, upper, lower);
  subEl.textContent = T_ICON[upper] + ' ' + T_NAME[upper] + '上' + T_NAME[lower] + '下 ' + T_ICON[lower];
  descEl.textContent = data.desc;
}

// ── 详情弹窗 ──

function showDetail(data, upper, lower) {
  if (!data) return;
  modalTitle.innerHTML = coloredNameHTML(data.name, upper, lower);
  modalSubtitle.textContent = T_ICON[upper] + ' ' + T_NAME[upper] + '上' + T_NAME[lower] + '下 ' + T_ICON[lower];
  const detail = data.detail || data.desc;
  const lines = data.lines;
  let html = '';
  if (detail) {
    // 如果包含 \n 则分段
    const parts = detail.split('\n');
    parts.forEach(p => {
      if (p.startsWith('【')) {
        const m = p.match(/【(.+?)】\s*(.*)/);
        if (m) {
          html += `<div class="modal-section"><h5>${m[1]}</h5><p>${m[2]}</p></div>`;
        } else {
          html += `<p>${p}</p>`;
        }
      } else {
        html += `<p>${p}</p>`;
      }
    });
  }
  if (lines && lines.length) {
    html += `<div class="modal-section"><h5>䷁ 爻辞</h5><p>${lines.join('\n')}</p></div>`;
  }
  modalBody.innerHTML = html;
  detailModal.classList.add('show');
}

function hideModal() {
  detailModal.classList.remove('show');
}

// ── 高岛易断弹窗 ──

function showTakashima(upper, lower, movingBits) {
  const data = TAKASHIMA[upper]?.[lower];
  if (!data) {
    // 没有高岛数据时降级
    modalTitle.innerHTML = coloredNameHTML(HEX[upper]?.[lower]?.name || '未知', upper, lower);
    modalSubtitle.textContent = '高岛易断 · 暂无对应断辞';
    modalBody.innerHTML = '<p style="color:#8888aa">该卦高岛易断数据尚缺。</p>';
    detailModal.classList.add('show');
    return;
  }
  const hexName = HEX[upper]?.[lower]?.name || '未知';
  modalTitle.innerHTML = coloredNameHTML(hexName, upper, lower);
  modalSubtitle.innerHTML = '📜 高岛易断 · <span style="color:#c49a7a">高岛嘉右卫门</span>';

  let html = `<div class="modal-section"><h5>断辞</h5><p>${data.judgment}</p></div>`;

  // 动爻解读
  const movingPositions = [];
  movingBits.forEach((m,i) => { if (m) movingPositions.push(i); });

  if (movingPositions.length > 0) {
    html += `<div class="modal-section"><h5>⚡ 动爻断（${movingPositions.map(i => POS_NAMES[i]).join('、')}）</h5>`;
    movingPositions.forEach(i => {
      if (data.lines && data.lines[i]) {
        html += `<p style="margin-bottom:.4rem">${data.lines[i]}</p>`;
      }
    });
    html += `</div>`;
  } else if (data.still) {
    // 六爻全静
    html += `<div class="modal-section"><h5>⚖ 六爻皆静</h5><p>${data.still}</p></div>`;
  } else if (data.lines) {
    // 没有静爻专文，给一个总体提示
    html += `<div class="modal-section"><h5>⚖ 六爻皆静</h5><p>此卦无动爻，宜以卦辞断之。守正而行，可获平安。</p></div>`;
  }

  html += `<div class="modal-section" style="border-top:1px solid rgba(255,255,255,.04);padding-top:.8rem">
    <p style="font-size:.75rem;color:#6b6b8a;line-height:1.6">
      《高岛易断》为日本明治时期易学家高岛嘉右卫门（1832-1914）所著，
      以"高岛流"断卦法闻名于世。其法重动爻、察时势、通经义，本书断辞节选自其核心要义。
    </p>
  </div>`;

  modalBody.innerHTML = html;
  detailModal.classList.add('show');
}

// ── 纳甲排盘弹窗 ──

function showNayja(upper, lower) {
  const nayja = computeNayja(upper, lower);
  const hexData = HEX[upper]?.[lower];
  if (!nayja || !hexData) {
    modalTitle.textContent = '纳甲排盘';
    modalSubtitle.textContent = '无法排盘';
    modalBody.innerHTML = '<p style="color:#8888aa">缺少排盘数据</p>';
    detailModal.classList.add('show');
    return;
  }

  modalTitle.innerHTML = coloredNameHTML(hexData.name, upper, lower);
  modalSubtitle.innerHTML = `🔮 纳甲排盘 · ${nayja.palaceIcon}${nayja.palaceName}宫（${nayja.palaceElement}）· ${nayja.type}卦`;

  const lb = trigramBits(lower), ub = trigramBits(upper);
  const lineBits = [lb[0], lb[1], lb[2], ub[0], ub[1], ub[2]];

  let html = `<div class="nayja-table-wrap"><table class="nayja-table">
    <tr><th>爻位</th><th>爻</th><th>地支</th><th>五行</th><th>六亲</th></tr>`;

  for (let i = 5; i >= 0; i--) {
    const pos = POS_NAMES[i];
    const yang = lineBits[i] === 1;
    const lineHTML = yang ? '<span style="color:#d4a843">⚊</span>' : '<span style="color:#6b6b9a">⚋</span>';
    const dz = DIZHI[nayja.dizhi[i]];
    const wx = WUXING_NAMES[DIZHI_WUXING[nayja.dizhi[i]]];
    const wxColor = ['#d4a843','#27ae60','#3498db','#e74c3c','#8b7355'][DIZHI_WUXING[nayja.dizhi[i]]];
    const lqIdx = nayja.liuqin[i];
    const lq = LIUQIN_NAMES[lqIdx];
    const lqColor = LIUQIN_COLORS[lqIdx];

    let mark = '';
    if (i === nayja.shi) mark = ' <span class="nayja-shi">⚑ 世</span>';
    if (i === nayja.ying) mark = ' <span class="nayja-ying">⚐ 应</span>';

    html += `<tr>
      <td class="nayja-pos">${pos}${mark}</td>
      <td>${lineHTML}</td>
      <td class="nayja-dz">${dz}</td>
      <td class="nayja-wx" style="color:${wxColor}">${wx}</td>
      <td class="nayja-lq" style="color:${lqColor}">${lq}</td>
    </tr>`;
  }

  html += `</table></div>`;

  html += `<div class="modal-section" style="margin-top:.8rem">
    <p style="font-size:.82rem;color:#8888aa;line-height:1.8">
      此卦入 <b style="color:#e8d5a3">${nayja.palaceName}宫</b>（五行${nayja.palaceElement}），为<b style="color:#e8d5a3">${nayja.type}卦</b>。
      世爻在 <b style="color:#ffd700">${POS_NAMES[nayja.shi]}</b>（代表问卦者），
      应爻在 <b style="color:#7ec8e3">${POS_NAMES[nayja.ying]}</b>（代表对方/所问之事）。
    </p>
  </div>

  <!-- 纳甲入门说明 -->
  <details style="margin-top:1rem;background:rgba(255,255,255,.02);border-radius:8px;padding:.6rem 1rem;cursor:pointer">
    <summary style="font-size:.82rem;color:#c49a7a;font-weight:600">📘 怎么看纳甲排盘？</summary>
    <div style="font-size:.78rem;color:#a0a0b8;line-height:1.8;margin-top:.5rem">
      <p><b style="color:#d4a843">┃ 地支</b> 每爻配一个地支（子丑寅卯…），由卦所属的宫位和爻位决定。</p>
      <p><b style="color:#d4a843">┃ 五行</b> 地支各自对应五行（金木水火土），决定爻的"气场"。</p>
      <p><b style="color:#d4a843">┃ 六亲</b> 以宫卦的五行为"我"，与各爻五行比较得出：
        <span style="color:#3498db">父母</span>（生我）、<span style="color:#27ae60">兄弟</span>（同我）、
        <span style="color:#e74c3c">官鬼</span>（克我）、<span style="color:#f39c12">妻财</span>（我克）、
        <span style="color:#1abc9c">子孙</span>（我生）。</p>
      <p><b style="color:#d4a843">┃ 世应</b> <b style="color:#ffd700">世爻</b>代表问卦者自己，<b style="color:#7ec8e3">应爻</b>代表对方或所问之事。看世应的五行关系，可判断双方的生克状态。</p>
      <p style="margin-top:.4rem;color:#6b6b8a;font-size:.7rem">💡 <b>入门用法</b>：先看世爻的六亲是什么（比如"妻财"问财运好、"官鬼"问事业需谨慎），再看应爻与之对比，最后看有没有动爻改变格局。</p>
    </div>
  </details>`;

  // 📋 复制排盘按钮
  html += `<button id="copyNayjaBtn" style="margin-top:1rem;width:100%;padding:.6rem;border-radius:8px;border:1px solid rgba(212,168,67,.2);background:rgba(212,168,67,.06);color:#d4a843;font-size:.82rem;cursor:pointer;font-family:inherit;transition:all .25s">📋 复制排盘给AI（含本卦+变卦）</button>`;

  modalBody.innerHTML = html;

  // 复制排盘事件
  const nayjaCopyBtn = document.getElementById('copyNayjaBtn');
  if (nayjaCopyBtn) {
    nayjaCopyBtn.addEventListener('mouseenter', () => { nayjaCopyBtn.style.background = 'rgba(212,168,67,.14)'; });
    nayjaCopyBtn.addEventListener('mouseleave', () => { nayjaCopyBtn.style.background = 'rgba(212,168,67,.06)'; });
    nayjaCopyBtn.addEventListener('click', () => {
      // 始终从 lastResult 读取本卦+变卦，不依赖弹窗的 upper/lower 参数
      const parts = [];
      if (lastResult) {
        const origNayja = computeNayja(lastResult.origUpper, lastResult.origLower);
        if (origNayja) {
          parts.push(formatNayjaText(origNayja, lastResult.origUpper, lastResult.origLower, '本卦'));
        }
        const hasChange = lastResult.changeUpper !== lastResult.origUpper || lastResult.changeLower !== lastResult.origLower;
        if (hasChange) {
          const chgNayja = computeNayja(lastResult.changeUpper, lastResult.changeLower);
          if (chgNayja) {
            parts.push(formatNayjaText(chgNayja, lastResult.changeUpper, lastResult.changeLower, '变卦'));
          }
        }
      }
      const text = parts.join('\n\n');
      copyToClipboard(text, nayjaCopyBtn, '✅ 已复制！', '📋 复制排盘给AI（含本卦+变卦）', 2000);
    });
  }

  detailModal.classList.add('show');
}

// ── 保存与历史 ──

function saveToHistory(result) {
  const history = JSON.parse(localStorage.getItem('yijingHistory') || '[]');
  const time = new Date().toLocaleString('zh-CN', { hour12: false });
  history.unshift({
    origBits: result.origBits,
    changeBits: result.changeBits,
    movingBits: result.movingBits,
    origName: result.origFullName,
    changeName: result.changeFullName,
    time
  });
  if (history.length > 50) history.pop();
  localStorage.setItem('yijingHistory', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem('yijingHistory') || '[]');
  if (history.length === 0) {
    historyList.innerHTML = '<p style="font-size:.78rem;color:#6b6b8a">暂无记录</p>';
    return;
  }
  historyList.innerHTML = history.map((item, i) =>
    `<div class="history-item" data-idx="${i}">
      <span><span class="h-name">${item.origName}</span> → ${item.changeName}</span>
      <span class="h-time">${item.time}</span>
    </div>`
  ).join('');
  historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      const history = JSON.parse(localStorage.getItem('yijingHistory') || '[]');
      const item = history[idx];
      if (item) restoreFromHistory(item);
    });
  });
}

function restoreFromHistory(item) {
  const origResult = lookup(item.origBits);
  const changeResult = lookup(item.changeBits);
  renderHexagramColored(origLines, item.origBits, item.movingBits, origResult.upper, origResult.lower);
  renderHexagramColored(changeLines, item.changeBits, new Array(6).fill(0), changeResult.upper, changeResult.lower);
  setHexagramInfo(origName, origNameSub, origDesc, origResult.data, origResult.upper, origResult.lower);
  setHexagramInfo(changeName, changeNameSub, changeDesc, changeResult.data, changeResult.upper, changeResult.lower);
  const movingPositions = item.movingBits.map((m,i)=>m?POS_NAMES[i]:null).filter(Boolean);
  let html = `<p>📜 历史记录 · <strong style="color:#d4a843">${item.origName}</strong> 卦`;
  if (movingPositions.length) html += `，<strong style="color:#ff4757">${movingPositions.join('、')}</strong> 动，变 <strong style="color:#d4a843">${item.changeName}</strong> 卦`;
  html += '。</p>';
  readingText.innerHTML = html;
  reading.style.display = 'block';
  reading.classList.add('show');
  hexSection.style.display = 'block';
  historyPanel.classList.remove('show');
  // 更新 lastResult
  lastResult = {
    origBits: item.origBits,
    movingBits: item.movingBits,
    changeBits: item.changeBits,
    origFullName: item.origName,
    changeFullName: item.changeName,
    origUpper: origResult.upper,
    origLower: origResult.lower,
    changeUpper: changeResult.upper,
    changeLower: changeResult.lower
  };
}

// ── 保存图片 ──

function saveImage() {
  if (!lastResult) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const W = 600;

  // ── 尺寸参数 ──
  const lineH = 38, gap = 10;          // 每条爻高度 + 间距
  const lineStep = lineH + gap;        // 48
  const blockH = 6 * lineStep;         // 6爻总高 288
  const hasChange = lastResult.changeFullName !== lastResult.origFullName;
  const hasMoving = lastResult.movingBits.some(m => m);

  // ── Y 坐标布局（从顶向下） ──
  const yTop = 60;                     // 顶部装饰线
  const yTitle = 110;                  // "周易摇卦"
  const yName = 170;                   // 本卦名称
  const yDesc = 205;                   // 卦辞
  const yOrigLabel = 255;              // "本卦" 标签
  const yOrig = 265;                   // 本卦第一爻
  const yOrigEnd = yOrig + blockH;     // 本卦底
  const yCGap = yOrigEnd + 28;         // 变卦段顶部间隙
  const yCLabel = yCGap + 18;          // "变卦" 标签
  const yCName = yCGap + 18;           // "变 → ××"
  const yChange = yCGap + 40;          // 变卦第一爻
  const yChangeEnd = yChange + (hasChange ? blockH : 0);
  const yMoving = yChangeEnd + (hasMoving ? 26 : 10);
  const yTime = yMoving + (hasMoving ? 22 : 0) + 40;
  const yBottom = yTime + 40;

  // ── 计算画布高度 ──
  const H = yBottom + 20;
  canvas.width = W;
  canvas.height = H;

  // ── 背景 ──
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#1a1a2e');
  bgGrad.addColorStop(1, '#16213e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ── 顶部装饰线 ──
  ctx.strokeStyle = 'rgba(212,168,67,.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, yTop);
  ctx.lineTo(W - 60, yTop);
  ctx.stroke();

  // ── 标题 ──
  ctx.fillStyle = '#d4a843';
  ctx.font = 'bold 28px "KaiTi", "STKaiti", serif';
  ctx.textAlign = 'center';
  ctx.fillText('周易摇卦', W / 2, yTitle);

  // ── 本卦名称 ──
  const origFull = lastResult.origFullName;
  ctx.fillStyle = '#f0e6d3';
  ctx.font = 'bold 36px "KaiTi", "STKaiti", serif';
  ctx.fillText(origFull, W / 2, yName);

  // ── 本卦描述 ──
  ctx.fillStyle = '#8888aa';
  ctx.font = '16px "KaiTi", "STKaiti", serif';
  const origData = HEX[lastResult.origUpper]?.[lastResult.origLower];
  if (origData) ctx.fillText(origData.desc || '', W / 2, yDesc);

  // ── 绘制卦象 ──
  const ox = 180, lineWidth = 240;
  const upperColor = '#d4a843', lowerColor = '#5b9bd5';
  const origBits = lastResult.origBits;
  const movBits = lastResult.movingBits;

  // 绘制本卦
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8888aa';
  ctx.font = '14px "KaiTi", "STKaiti", serif';
  ctx.fillText('本卦', 60, yOrigLabel);

  for (let i = 0; i < 6; i++) {
    const y = yOrig + i * lineStep;
    ctx.fillStyle = i >= 3 ? upperColor : lowerColor;
    if (origBits[i] === 1) {
      ctx.fillRect(ox, y, lineWidth, lineH);
    } else {
      ctx.fillRect(ox, y, lineWidth * 0.42, lineH);
      ctx.fillRect(ox + lineWidth * 0.58, y, lineWidth * 0.42, lineH);
    }
    if (movBits[i]) {
      ctx.fillStyle = '#ff4757';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('●', ox + lineWidth + 20, y + lineH / 2 + 7);
    }
  }

  // ── 变卦 ──
  if (hasChange) {
    const chName = lastResult.changeFullName;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8888aa';
    ctx.font = '14px "KaiTi", "STKaiti", serif';
    ctx.fillText('变卦', 60, yCLabel);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#f0e6d3';
    ctx.font = 'bold 24px "KaiTi", "STKaiti", serif';
    ctx.fillText('变 → ' + chName, W - 60, yCName);

    const changeBits = lastResult.changeBits;
    for (let i = 0; i < 6; i++) {
      const y = yChange + i * lineStep;
      ctx.fillStyle = i >= 3 ? upperColor : lowerColor;
      if (changeBits[i] === 1) {
        ctx.fillRect(ox, y, lineWidth, lineH);
      } else {
        ctx.fillRect(ox, y, lineWidth * 0.42, lineH);
        ctx.fillRect(ox + lineWidth * 0.58, y, lineWidth * 0.42, lineH);
      }
    }
  }

  // ── 动爻信息 ──
  if (hasMoving) {
    const movingPos = [];
    movBits.forEach((m, idx) => { if (m) movingPos.push(POS_NAMES[idx]); });
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4757';
    ctx.font = '16px "KaiTi", "STKaiti", serif';
    ctx.fillText('动爻：' + movingPos.join('、'), W / 2, yMoving);
  }

  // ── 时间 ──
  const time = new Date().toLocaleString('zh-CN', { hour12: false });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#55556a';
  ctx.font = '13px monospace';
  ctx.fillText(time, W / 2, yTime);

  // ── 底部装饰线 ──
  ctx.strokeStyle = 'rgba(212,168,67,.2)';
  ctx.beginPath();
  ctx.moveTo(60, yBottom);
  ctx.lineTo(W - 60, yBottom);
  ctx.stroke();

  // ── 触发下载 ──
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${origFull}_${time.replace(/[/ :]/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

// ── 从 URL hash 恢复 ──

function loadFromHash() {
  const hash = window.location.hash.replace('#', '').trim();
  if (!hash || hash.length !== 6 || !/^[01]+$/.test(hash)) return;
  const bits = hash.split('').map(Number);
  const result = lookup(bits);
  const movingBits = [0,0,0,0,0,0];
  renderHexagramColored(origLines, bits, movingBits, result.upper, result.lower);
  setHexagramInfo(origName, origNameSub, origDesc, result.data, result.upper, result.lower);
  changeName.textContent = '';
  changeNameSub.textContent = '';
  changeLines.innerHTML = '';
  changeDesc.textContent = '';
  readingText.innerHTML = `<p>🔗 分享的卦象 · <strong style="color:#d4a843">${getFullName(result.upper, result.lower)}</strong></p><p style="margin-top:.6rem">${result.data.desc}</p>`;
  reading.style.display = 'block';
  reading.classList.add('show');
  hexSection.style.display = 'block';
  actionBar.style.display = 'flex';
  lastResult = {
    origBits: bits, movingBits, changeBits: bits,
    origFullName: getFullName(result.upper, result.lower),
    changeFullName: getFullName(result.upper, result.lower),
    origUpper: result.upper, origLower: result.lower,
    changeUpper: result.upper, changeLower: result.lower
  };
}

// ── 主事件：摇卦 ──

castBtn.addEventListener('click', async ()=>{
  if(isAnimating) return;
  isAnimating = true;
  castBtn.disabled = true;
  castBtn.innerHTML = '<span class="spinner"></span>投掷中…';

  hexSection.style.display = 'none';
  reading.classList.remove('show');
  reading.style.display = 'none';
  actionBar.style.display = 'none';
  historyPanel.classList.remove('show');

  tossArea.innerHTML = '';
  const allResults = [];

  for(let i=0; i<6; i++){
    const coins = tossThree();
    const res = judge(coins);
    allResults.push(res);

    const row = document.createElement('div');
    row.className = 'toss-row';

    const pos = document.createElement('span');
    pos.className = 'pos';
    pos.textContent = POS_NAMES[i];
    row.appendChild(pos);

    const coinWrap = document.createElement('div');
    coinWrap.className = 'coins';
    coins.forEach(c=>{
      const d = document.createElement('div');
      d.className = 'coin ' + (c===0?'tzi':'fa');
      d.textContent = c===0 ? '字' : '花';
      coinWrap.appendChild(d);
    });
    row.appendChild(coinWrap);

    const resultDiv = document.createElement('div');
    resultDiv.className = 'toss-result' + (res.moving?' moving':' still');
    resultDiv.innerHTML = `<div class="verdict">${res.label}</div><div class="sub">${res.sub}${res.moving?' · 动爻':''}</div>`;
    row.appendChild(resultDiv);

    tossArea.appendChild(row);

    await new Promise(r=>requestAnimationFrame(()=>{
      setTimeout(()=>{ row.classList.add('visible'); r(); }, 80);
    }));
  }

  const origBits = allResults.map(r=>r.value);
  const movingBits = allResults.map(r=>r.moving?1:0);
  const changeBits = origBits.map((v,i)=> movingBits[i] ? (1-v) : v);

  const origResult = lookup(origBits);
  const changeResult = lookup(changeBits);

  renderHexagramColored(origLines, origBits, movingBits, origResult.upper, origResult.lower);
  renderHexagramColored(changeLines, changeBits, new Array(6).fill(0), changeResult.upper, changeResult.lower);

  setHexagramInfo(origName, origNameSub, origDesc, origResult.data, origResult.upper, origResult.lower);
  setHexagramInfo(changeName, changeNameSub, changeDesc, changeResult.data, changeResult.upper, changeResult.lower);

  // 解读
  const movingPositions = [];
  movingBits.forEach((m,i)=>{ if(m) movingPositions.push(POS_NAMES[i]); });
  const origFull = getFullName(origResult.upper, origResult.lower);
  const changeFull = getFullName(changeResult.upper, changeResult.lower);

  let readingHtml = `<p>摇得 <strong style="color:#d4a843">${origFull}</strong> 卦`;
  if(movingPositions.length>0){
    readingHtml += `，<strong style="color:#ff4757">${movingPositions.join('、')}</strong> 动`;
    readingHtml += `，变 <strong style="color:#d4a843">${changeFull}</strong> 卦`;
  } else {
    readingHtml += `，<span style="color:#8888aa">六爻皆静，本卦即变卦</span>`;
  }
  readingHtml += '。</p>';
  readingHtml += `<p style="margin-top:.6rem">${origFull}：${origResult.data.desc}</p>`;
  if(movingPositions.length>0 && origResult.data.name !== changeResult.data.name){
    readingHtml += `<p style="margin-top:.6rem;padding-top:.6rem;border-top:1px solid rgba(255,255,255,.05)">${changeFull}：${changeResult.data.desc}</p>`;
  }

  if(movingPositions.length>0){
    const movingInfo = allResults.map((r,i)=>{
      if(r.moving) return `${POS_NAMES[i]}(${r.label})`;
      return null;
    }).filter(Boolean).join('、');
    readingHtml += `<p style="margin-top:.6rem;font-size:.8rem;color:#8888aa">动爻变化：${movingInfo}</p>`;
  }

  readingText.innerHTML = readingHtml;
  reading.style.display = 'block';
  setTimeout(()=>reading.classList.add('show'), 50);

  hexSection.style.display = 'block';
  actionBar.style.display = 'flex';
  hexSection.scrollIntoView({behavior:'smooth',block:'start'});

  lastResult = {
    origBits, movingBits, changeBits, allResults,
    origFullName: origFull,
    changeFullName: changeFull,
    origUpper: origResult.upper,
    origLower: origResult.lower,
    changeUpper: changeResult.upper,
    changeLower: changeResult.lower,
    origResult, changeResult
  };

  castBtn.innerHTML = '再摇一卦';
  castBtn.disabled = false;
  isAnimating = false;
});

// ── 详情按钮 ──
document.querySelectorAll('.hex-detail-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!lastResult) return;
    const box = btn.dataset.box;
    if (box === 'orig') {
      showDetail(HEX[lastResult.origUpper][lastResult.origLower], lastResult.origUpper, lastResult.origLower);
    } else {
      showDetail(HEX[lastResult.changeUpper][lastResult.changeLower], lastResult.changeUpper, lastResult.changeLower);
    }
  });
});

// ── 高岛易断按钮 ──
document.querySelectorAll('.takashima-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!lastResult) return;
    const box = btn.dataset.box;
    if (box === 'orig') {
      showTakashima(lastResult.origUpper, lastResult.origLower, lastResult.movingBits);
    } else {
      showTakashima(lastResult.changeUpper, lastResult.changeLower, new Array(6).fill(0));
    }
  });
});

// ── 纳甲排盘按钮 ──
document.querySelectorAll('.nayja-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!lastResult) return;
    const box = btn.dataset.box;
    if (box === 'orig') {
      showNayja(lastResult.origUpper, lastResult.origLower);
    } else {
      showNayja(lastResult.changeUpper, lastResult.changeLower);
    }
  });
});

origName.addEventListener('click', () => {
  if (lastResult) showDetail(HEX[lastResult.origUpper][lastResult.origLower], lastResult.origUpper, lastResult.origLower);
});
changeName.addEventListener('click', () => {
  if (lastResult) showDetail(HEX[lastResult.changeUpper][lastResult.changeLower], lastResult.changeUpper, lastResult.changeLower);
});

modalClose.addEventListener('click', hideModal);
detailModal.addEventListener('click', e => { if(e.target===detailModal) hideModal(); });

// ── 保存 ──
saveBtn.addEventListener('click', () => {
  if (!lastResult) return;
  saveToHistory(lastResult);
  saveBtn.textContent = '✅ 已保存';
  setTimeout(() => saveBtn.textContent = '💾 保存此卦', 1500);
});

// ── 保存图片 ──
shareBtn.addEventListener('click', saveImage);

// ── 历史 ──
historyBtn.addEventListener('click', () => {
  historyPanel.classList.toggle('show');
  renderHistory();
});
clearHistoryBtn.addEventListener('click', () => {
  if (confirm('确定清空所有摇卦记录？')) {
    localStorage.removeItem('yijingHistory');
    renderHistory();
    historyPanel.classList.remove('show');
  }
});

/** 安全复制到剪贴板（兼容 file:// 协议） */
function copyToClipboard(text, btnEl, doneText, resetText, timeoutMs) {
  const ms = timeoutMs || 2000;
  btnEl.textContent = doneText;
  // 用 textarea 方案最稳妥，file:// 和 https 都支持
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ }
  document.body.removeChild(ta);
  setTimeout(() => { btnEl.textContent = resetText; }, ms);
}

// ── 复制解读文本（AI友好） ──
document.getElementById('copyReadingBtn').addEventListener('click', () => {
  const text = readingText.innerText || readingText.textContent;
  if (!text) return;
  copyToClipboard(text.trim(), document.getElementById('copyReadingBtn'), '✅ 已复制！', '📋 复制解读文本给AI', 2000);
});
// 点击解读区域也行
document.getElementById('readingText').addEventListener('click', () => {
  document.getElementById('copyReadingBtn').click();
});

// ── 复制纳甲排盘（从 reading 区域，始终正确） ──
document.getElementById('copyNayjaReadingBtn').addEventListener('click', () => {
  if (!lastResult) return;
  const parts = [];

  // 本卦纳甲
  const origNayja = computeNayja(lastResult.origUpper, lastResult.origLower);
  if (origNayja) {
    parts.push(formatNayjaText(origNayja, lastResult.origUpper, lastResult.origLower, '本卦'));
  }

  // 变卦存在且不同 → 追加变卦纳甲
  const hasChange = lastResult.changeUpper !== lastResult.origUpper || lastResult.changeLower !== lastResult.origLower;
  if (hasChange) {
    const chgNayja = computeNayja(lastResult.changeUpper, lastResult.changeLower);
    if (chgNayja) {
      parts.push(formatNayjaText(chgNayja, lastResult.changeUpper, lastResult.changeLower, '变卦'));
    }
  }

  const btn = document.getElementById('copyNayjaReadingBtn');
  const text = parts.join('\n\n');
  if (text) {
    copyToClipboard(text, btn, '✅ 已复制！', '🔮 复制纳甲排盘给AI', 2000);
  }
});

/** 格式化纳甲排盘为 AI 友好文本 */
function formatNayjaText(nayja, upper, lower, label) {
  const hexData = HEX[upper]?.[lower];
  if (!nayja || !hexData) return '';
  const lb = trigramBits(lower), ub = trigramBits(upper);
  const lineBits = [lb[0], lb[1], lb[2], ub[0], ub[1], ub[2]];
  let lines = [];
  const fullName = getFullName(upper, lower);
  const tag = label ? `【纳甲排盘 · ${label}】` : '【纳甲排盘】';
  // 标题行
  lines.push(`${tag}${fullName} — ${nayja.palaceName}宫（${nayja.palaceElement}）· ${nayja.type}卦`);
  lines.push(`世爻在${POS_NAMES[nayja.shi]}（代表问卦者），应爻在${POS_NAMES[nayja.ying]}（代表对方/所问之事）。`);
  lines.push('');
  // 表头
  lines.push('爻位 │ 爻 │ 地支 │ 五行 │ 六亲');
  lines.push('─────┼───┼────┼────┼────');
  // 每爻
  for (let i = 5; i >= 0; i--) {
    const pos = POS_NAMES[i];
    const yang = lineBits[i] === 1;
    const lineStr = yang ? '⚊' : '⚋';
    const dz = DIZHI[nayja.dizhi[i]];
    const wx = WUXING_NAMES[DIZHI_WUXING[nayja.dizhi[i]]];
    const lq = LIUQIN_NAMES[nayja.liuqin[i]];
    let mark = '';
    if (i === nayja.shi) mark = ' ⚑世';
    if (i === nayja.ying && i !== nayja.shi) mark = ' ⚐应';
    if (i === nayja.shi && i === nayja.ying) mark = ' ⚑⚐世应';
    lines.push(`${pos} │ ${lineStr} │ ${dz} │ ${wx} │ ${lq}${mark}`);
  }
  return lines.join('\n');
}

// ── 初始化 ──
renderHistory();
loadFromHash();
