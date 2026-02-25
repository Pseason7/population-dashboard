'use strict';

let allData = [];
let collapsedSido    = new Set();
let collapsedSigungu = new Set();

let sortCol = 'population';  // name | pop60 | pop70 | population
let sortDir = -1;            // 1 = 오름차순, -1 = 내림차순

let activeTab = 'table';
let mapInitialized = false;
let pendingMapFocus = null;  // 표→지도 이동 예약
let leafletMap = null;
let mapMarkers = [];
let activeBoundary = null;
const boundaryCache = {};
let boundaryFetchId = 0;

// 체크박스 표시 레벨 상태 (기본: 시/군/구 체크)
let levelChecks = { sido: false, sg: true, dong: false };

function syncCheckboxUI() {
  const map = { 'cb-sido': 'sido', 'cb-sg': 'sg', 'cb-dong': 'dong' };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.checked = levelChecks[key];
  });
}

const VWORLD_KEY = 'D1F79AEF-C13E-3AE7-9018-4EACD74A5B54';

// ── 유틸 ─────────────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 좌표 테이블 (시/도 → 시/군/구) ──────────
const GEO = {
  '서울특별시': { c:[37.5665,126.9780], d:{
    '종로구':[37.5730,126.9794],'중구':[37.5641,126.9979],'용산구':[37.5320,126.9907],
    '성동구':[37.5634,127.0369],'광진구':[37.5385,127.0823],'동대문구':[37.5744,127.0396],
    '중랑구':[37.6063,127.0927],'성북구':[37.5894,127.0167],'강북구':[37.6396,127.0253],
    '도봉구':[37.6688,127.0471],'노원구':[37.6542,127.0568],'은평구':[37.6026,126.9291],
    '서대문구':[37.5791,126.9368],'마포구':[37.5663,126.9014],'양천구':[37.5270,126.8558],
    '강서구':[37.5509,126.8496],'구로구':[37.4954,126.8874],'금천구':[37.4569,126.8952],
    '영등포구':[37.5263,126.8963],'동작구':[37.5124,126.9393],'관악구':[37.4784,126.9516],
    '서초구':[37.4837,127.0324],'강남구':[37.5172,127.0473],'송파구':[37.5145,127.1059],
    '강동구':[37.5301,127.1238]
  }},
  '부산광역시': { c:[35.1796,129.0756], d:{
    '중구':[35.1060,129.0323],'서구':[35.0972,129.0245],'동구':[35.1358,129.0451],
    '영도구':[35.0911,129.0678],'부산진구':[35.1594,129.0532],'동래구':[35.1985,129.0848],
    '남구':[35.1367,129.0839],'북구':[35.1972,128.9898],'해운대구':[35.1636,129.1640],
    '사하구':[35.1037,128.9745],'금정구':[35.2433,129.0927],'강서구':[35.2131,128.9805],
    '연제구':[35.1760,129.0801],'수영구':[35.1450,129.1133],'사상구':[35.1520,128.9923],
    '기장군':[35.2444,129.2222]
  }},
  '대구광역시': { c:[35.8714,128.6014], d:{
    '중구':[35.8695,128.5997],'동구':[35.8869,128.6353],'서구':[35.8715,128.5591],
    '남구':[35.8457,128.5963],'북구':[35.8852,128.5826],'수성구':[35.8584,128.6308],
    '달서구':[35.8298,128.5330],'달성군':[35.7753,128.4313]
  }},
  '인천광역시': { c:[37.4563,126.7052], d:{
    '중구':[37.4741,126.6216],'동구':[37.4745,126.6432],'미추홀구':[37.4633,126.6506],
    '연수구':[37.4101,126.6782],'남동구':[37.4467,126.7311],'부평구':[37.5074,126.7221],
    '계양구':[37.5374,126.7378],'서구':[37.5456,126.6760],'강화군':[37.7474,126.4878],
    '옹진군':[37.4519,126.2498]
  }},
  '광주광역시': { c:[35.1595,126.8526], d:{
    '동구':[35.1464,126.9230],'서구':[35.1518,126.8896],'남구':[35.1329,126.9023],
    '북구':[35.1740,126.9114],'광산구':[35.1395,126.7935]
  }},
  '대전광역시': { c:[36.3504,127.3845], d:{
    '동구':[36.3121,127.4545],'중구':[36.3248,127.4212],'서구':[36.3554,127.3831],
    '유성구':[36.3624,127.3566],'대덕구':[36.3466,127.4155]
  }},
  '울산광역시': { c:[35.5384,129.3114], d:{
    '중구':[35.5694,129.3326],'남구':[35.5383,129.3365],'동구':[35.5051,129.4163],
    '북구':[35.5824,129.3614],'울주군':[35.5197,129.2402]
  }},
  '세종특별자치시': { c:[36.4801,127.2890], d:{} },
  '경기도': { c:[37.4138,127.5183], d:{
    '수원시':[37.2636,127.0286],'성남시':[37.4449,127.1388],'고양시':[37.6584,126.8320],
    '용인시':[37.2411,127.1775],'부천시':[37.5035,126.7660],'안산시':[37.3219,126.8309],
    '안양시':[37.3943,126.9568],'남양주시':[37.6360,127.2162],'화성시':[37.1997,126.8310],
    '평택시':[36.9921,127.1127],'의정부시':[37.7381,127.0338],'시흥시':[37.3800,126.8030],
    '파주시':[37.7600,126.7800],'김포시':[37.6155,126.7158],'광명시':[37.4785,126.8644],
    '광주시':[37.4294,127.2554],'군포시':[37.3615,126.9353],'하남시':[37.5397,127.2148],
    '오산시':[37.1500,127.0776],'이천시':[37.2724,127.4347],'안성시':[37.0078,127.2798],
    '의왕시':[37.3449,126.9680],'양주시':[37.7855,127.0456],'구리시':[37.5944,127.1298],
    '포천시':[37.8945,127.2003],'여주시':[37.2977,127.6376],'동두천시':[37.9039,127.0608],
    '과천시':[37.4292,126.9879],'가평군':[37.8316,127.5106],'양평군':[37.4914,127.4878],
    '연천군':[38.0957,127.0748]
  }},
  '강원특별자치도': { c:[37.8228,128.1555], d:{
    '춘천시':[37.8813,127.7298],'원주시':[37.3422,127.9201],'강릉시':[37.7519,128.8761],
    '동해시':[37.5244,129.1142],'태백시':[37.1640,128.9858],'속초시':[38.2070,128.5918],
    '삼척시':[37.4497,129.1660],'홍천군':[37.6977,127.8884],'횡성군':[37.4912,127.9845],
    '영월군':[37.1838,128.4614],'평창군':[37.3706,128.3876],'정선군':[37.3799,128.6598],
    '철원군':[38.1464,127.3127],'화천군':[38.1063,127.7081],'양구군':[38.1099,127.9894],
    '인제군':[38.0694,128.1705],'고성군':[38.3803,128.4700],'양양군':[38.0753,128.6211]
  }},
  '강원도': { c:[37.8228,128.1555], d:{} },
  '충청북도': { c:[36.6357,127.4913], d:{
    '청주시':[36.6424,127.4890],'충주시':[36.9910,127.9259],'제천시':[37.1326,128.1910],
    '보은군':[36.4894,127.7298],'옥천군':[36.3061,127.5711],'영동군':[36.1747,127.7781],
    '증평군':[36.7854,127.5821],'진천군':[36.8554,127.4350],'괴산군':[36.8153,127.7870],
    '음성군':[36.9397,127.6900],'단양군':[36.9845,128.3651]
  }},
  '충청남도': { c:[36.5184,126.8000], d:{
    '천안시':[36.8151,127.1139],'공주시':[36.4465,127.1192],'보령시':[36.3332,126.6128],
    '아산시':[36.7898,127.0020],'서산시':[36.7849,126.4503],'논산시':[36.1874,127.0987],
    '계룡시':[36.2740,127.2489],'당진시':[36.8895,126.6450],'금산군':[36.1091,127.4882],
    '부여군':[36.2748,126.9099],'서천군':[36.0779,126.6916],'청양군':[36.4591,126.8031],
    '홍성군':[36.6011,126.6606],'예산군':[36.6825,126.8461],'태안군':[36.7455,126.2977]
  }},
  '전북특별자치도': { c:[35.7175,127.1530], d:{
    '전주시':[35.8242,127.1480],'군산시':[35.9677,126.7363],'익산시':[35.9483,126.9577],
    '정읍시':[35.5698,126.8562],'남원시':[35.4166,127.3900],'김제시':[35.8031,126.8800],
    '완주군':[35.9082,127.1630],'진안군':[35.7907,127.4241],'무주군':[36.0066,127.6604],
    '장수군':[35.6473,127.5219],'임실군':[35.6175,127.2897],'순창군':[35.3741,127.1377],
    '고창군':[35.4358,126.7019],'부안군':[35.7319,126.7319]
  }},
  '전라북도': { c:[35.7175,127.1530], d:{} },
  '전라남도': { c:[34.8161,126.4629], d:{
    '목포시':[34.8118,126.3922],'여수시':[34.7604,127.6622],'순천시':[34.9506,127.4874],
    '나주시':[35.0160,126.7112],'광양시':[34.9404,127.6954],'담양군':[35.3216,126.9884],
    '곡성군':[35.2818,127.2921],'구례군':[35.2027,127.4627],'고흥군':[34.6071,127.2766],
    '보성군':[34.7715,127.0801],'화순군':[35.0647,126.9863],'장흥군':[34.6817,126.9097],
    '강진군':[34.6403,126.7668],'해남군':[34.5741,126.5993],'영암군':[34.8002,126.6967],
    '무안군':[34.9902,126.4813],'함평군':[35.0671,126.5202],'영광군':[35.2779,126.5122],
    '장성군':[35.3019,126.7895],'완도군':[34.3104,126.7543],'진도군':[34.4869,126.2636],
    '신안군':[34.8361,126.1030]
  }},
  '경상북도': { c:[36.4919,128.8889], d:{
    '포항시':[36.0190,129.3435],'경주시':[35.8562,129.2247],'김천시':[36.1398,128.1136],
    '안동시':[36.5684,128.7294],'구미시':[36.1195,128.3444],'영주시':[36.8059,128.6240],
    '영천시':[35.9733,128.9383],'상주시':[36.4109,128.1591],'문경시':[36.5862,128.1863],
    '경산시':[35.8253,128.7411],'군위군':[36.2406,128.5700],'의성군':[36.3526,128.6971],
    '청송군':[36.4357,129.0568],'영양군':[36.6676,129.1127],'영덕군':[36.4152,129.3651],
    '청도군':[35.6473,128.7363],'고령군':[35.7277,128.2629],'성주군':[35.9195,128.2838],
    '칠곡군':[35.9963,128.4010],'예천군':[36.6544,128.4968],'봉화군':[36.8932,128.9320],
    '울진군':[37.0014,129.4027],'울릉군':[37.4851,130.9057]
  }},
  '경상남도': { c:[35.4606,128.2132], d:{
    '창원시':[35.2280,128.6811],'진주시':[35.1800,128.1076],'통영시':[34.8544,128.4330],
    '사천시':[35.0040,128.0644],'김해시':[35.2285,128.8888],'밀양시':[35.4875,128.7460],
    '거제시':[34.8802,128.6211],'양산시':[35.3350,129.0373],'의령군':[35.3224,128.2617],
    '함안군':[35.2727,128.4068],'창녕군':[35.5444,128.4928],'고성군':[34.9733,128.3229],
    '남해군':[34.8377,127.8918],'하동군':[35.0672,127.7514],'산청군':[35.4156,127.8739],
    '함양군':[35.5206,127.7239],'거창군':[35.6868,127.9094],'합천군':[35.5664,128.1659]
  }},
  '제주특별자치도': { c:[33.4890,126.4983], d:{
    '제주시':[33.5000,126.5311],'서귀포시':[33.2530,126.5597]
  }}
};

function getCoords(sido, sigungu) {
  const sidoData = GEO[sido];
  if (!sidoData) return null;
  if (!sigungu) return sidoData.c;
  return sidoData.d[sigungu] || sidoData.c;
}

// ── 데이터 로드 ──────────────────────────────
function loadData() {
  chrome.storage.local.get(['populationData'], (result) => {
    allData = result.populationData || [];
    buildFilters();
    collapseAll();  // 기본값: 모두 닫힘
  });
}


// ── 필터 셀렉트 ──────────────────────────────
function buildFilters() {
  const sidoSel = document.getElementById('f-sido');
  const curSido = sidoSel.value;
  const sidos = [...new Set(allData.map(d => d.sido).filter(Boolean))].sort();

  sidoSel.innerHTML = '<option value="">전체</option>';
  sidos.forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    if (s === curSido) o.selected = true;
    sidoSel.appendChild(o);
  });
  buildSigungu(sidoSel.value);
  buildDong(sidoSel.value, document.getElementById('f-sigungu').value);
}

function buildSigungu(selectedSido) {
  const sel = document.getElementById('f-sigungu');
  const cur = sel.value;
  const base = selectedSido ? allData.filter(d => d.sido === selectedSido) : allData;
  const list = [...new Set(base.map(d => d.sigungu).filter(Boolean))].sort();

  sel.innerHTML = '<option value="">전체</option>';
  list.forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    if (s === cur) o.selected = true;
    sel.appendChild(o);
  });
  buildDong(selectedSido, sel.value);
}

function buildDong(selectedSido, selectedSigungu) {
  const sel = document.getElementById('f-dong');
  const cur = sel.value;
  let base = allData.filter(d => d.dong !== d.sigungu); // 요약행 제외
  if (selectedSido)    base = base.filter(d => d.sido    === selectedSido);
  if (selectedSigungu) base = base.filter(d => d.sigungu === selectedSigungu);
  const list = [...new Set(base.map(d => d.dong).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));

  sel.innerHTML = '<option value="">전체</option>';
  list.forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    if (s === cur) o.selected = true;
    sel.appendChild(o);
  });
}

// ── 필터 적용 ────────────────────────────────
function getFiltered() {
  const sido    = document.getElementById('f-sido').value;
  const sigungu = document.getElementById('f-sigungu').value;
  const dong    = document.getElementById('f-dong').value;

  return allData.filter(d => {
    if (sido    && d.sido    !== sido)    return false;
    if (sigungu && d.sigungu !== sigungu) return false;
    if (dong    && d.dong    !== dong)    return false;
    return true;
  });
}

// ── 데이터 그루핑 ────────────────────────────
function groupData(data) {
  const grouped = new Map();

  data.forEach(d => {
    const sido    = d.sido    || '-';
    const sigungu = d.sigungu || '-';

    if (!grouped.has(sido))          grouped.set(sido, new Map());
    if (!grouped.get(sido).has(sigungu))
      grouped.get(sido).set(sigungu, { summary: null, dongs: [] });

    const sg = grouped.get(sido).get(sigungu);
    if (d.dong === sigungu) sg.summary = d;
    else                    sg.dongs.push(d);
  });

  return grouped;
}

// ── 정렬 헬퍼 ────────────────────────────────
// list: 정렬할 배열
// getKey(item): 이름 정렬용 키 문자열 반환
// getValues(item): [pop60, pop70, population] 반환
function sortList(list, getKey, getValues) {
  return [...list].sort((a, b) => {
    if (sortCol === 'name') {
      return sortDir * getKey(a).localeCompare(getKey(b), 'ko');
    }
    const idxMap = { pop60: 0, pop70: 1, population: 2 };
    const idx = idxMap[sortCol] ?? 2;
    const va = getValues(a)[idx] || 0;
    const vb = getValues(b)[idx] || 0;
    return sortDir === 1 ? va - vb : vb - va;
  });
}

function updateSortIcons() {
  ['name', 'pop60', 'pop70', 'population'].forEach(col => {
    const el = document.getElementById('sort-' + col);
    if (!el) return;
    if (col !== sortCol) {
      el.textContent = '⇅';
      el.className = 'sort-icon';
    } else {
      el.textContent = sortDir === 1 ? '▲' : '▼';
      el.className = 'sort-icon active';
    }
  });
}

// ── 트리 테이블 렌더링 ───────────────────────
function renderTreeTable(data) {
  const tbody    = document.getElementById('tbody');
  const emptyMsg = document.getElementById('empty-msg');
  document.getElementById('row-count').textContent = `${data.length.toLocaleString()}건`;

  if (data.length === 0) {
    tbody.innerHTML = '';
    emptyMsg.style.display = 'block';
    return;
  }
  emptyMsg.style.display = 'none';

  const grouped = groupData(data);

  // 시/도 집계
  const sidoAggr = new Map();
  grouped.forEach((sidoMap, sido) => {
    let s60 = 0, s70 = 0, sTotal = 0;
    sidoMap.forEach(sg => {
      const base = sg.summary || {
        pop60_69:   sg.dongs.reduce((a,d) => a+(d.pop60_69||0), 0),
        pop70_79:   sg.dongs.reduce((a,d) => a+(d.pop70_79||0), 0),
        population: sg.dongs.reduce((a,d) => a+(d.population||0), 0)
      };
      s60   += base.pop60_69   || 0;
      s70   += base.pop70_79   || 0;
      sTotal+= base.population || 0;
    });
    sidoAggr.set(sido, [s60, s70, sTotal]);
  });

  // 시/도 정렬
  const sidoList = sortList(
    [...grouped.keys()],
    k => k,
    k => sidoAggr.get(k)
  );

  const rows = [];

  sidoList.forEach(sido => {
    const sidoMap     = grouped.get(sido);
    const sidoCollapsed = collapsedSido.has(sido);
    const [s60, s70, sTotal] = sidoAggr.get(sido);

    rows.push(`
      <tr class="row-sido" data-sido="${esc(sido)}">
        <td class="sido-cell"><span class="tog">${sidoCollapsed ? '▶' : '▼'}</span>${esc(sido)}</td>
        <td class="num">${s60.toLocaleString()}</td>
        <td class="num">${s70.toLocaleString()}</td>
        <td class="total">${sTotal.toLocaleString()}</td>
      </tr>`);

    if (sidoCollapsed) return;

    // 시/군/구 정렬
    const sgList = sortList(
      [...sidoMap.keys()],
      k => k,
      k => {
        const sg = sidoMap.get(k);
        const base = sg.summary || {
          pop60_69:   sg.dongs.reduce((a,d) => a+(d.pop60_69||0), 0),
          pop70_79:   sg.dongs.reduce((a,d) => a+(d.pop70_79||0), 0),
          population: sg.dongs.reduce((a,d) => a+(d.population||0), 0)
        };
        return [base.pop60_69||0, base.pop70_79||0, base.population||0];
      }
    );

    sgList.forEach(sigungu => {
      const sg          = sidoMap.get(sigungu);
      const sgKey       = `${sido}|||${sigungu}`;
      const sgCollapsed = collapsedSigungu.has(sgKey);
      const base = sg.summary || {
        pop60_69:   sg.dongs.reduce((a,d) => a+(d.pop60_69||0), 0),
        pop70_79:   sg.dongs.reduce((a,d) => a+(d.pop70_79||0), 0),
        population: sg.dongs.reduce((a,d) => a+(d.population||0), 0)
      };

      rows.push(`
        <tr class="row-sigungu" data-sido="${esc(sido)}" data-sigungu="${esc(sigungu)}">
          <td class="sigungu-cell"><span class="tog">${sgCollapsed ? '▶' : '▼'}</span>${esc(sigungu)}</td>
          <td class="num">${(base.pop60_69  ||0).toLocaleString()}</td>
          <td class="num">${(base.pop70_79  ||0).toLocaleString()}</td>
          <td class="total">${(base.population||0).toLocaleString()}</td>
        </tr>`);

      if (sgCollapsed) return;

      // 동 정렬
      const dongs = sortList(
        sg.dongs,
        d => d.dong || '',
        d => [d.pop60_69||0, d.pop70_79||0, d.population||0]
      );

      dongs.forEach(d => {
        rows.push(`
          <tr class="row-dong" data-lat="${d.lat||''}" data-lng="${d.lng||''}" data-dong="${esc(d.dong)}" data-sigungu="${esc(d.sigungu)}" data-sido="${esc(d.sido)}">
            <td class="dong-cell">${esc(d.dong || '-')}${d.lat ? ' <span class="map-link" title="지도에서 보기">🗺</span>' : ''}</td>
            <td class="num">${(d.pop60_69  ||0).toLocaleString()}</td>
            <td class="num">${(d.pop70_79  ||0).toLocaleString()}</td>
            <td class="total">${(d.population||0).toLocaleString()}</td>
          </tr>`);
      });
    });
  });

  tbody.innerHTML = rows.join('');

  // 클릭 핸들러
  tbody.querySelectorAll('tr.row-sido').forEach(tr => {
    tr.addEventListener('click', () => {
      const k = tr.dataset.sido;
      collapsedSido.has(k) ? collapsedSido.delete(k) : collapsedSido.add(k);
      renderAll();
    });
  });
  tbody.querySelectorAll('tr.row-sigungu').forEach(tr => {
    tr.addEventListener('click', () => {
      const k = `${tr.dataset.sido}|||${tr.dataset.sigungu}`;
      collapsedSigungu.has(k) ? collapsedSigungu.delete(k) : collapsedSigungu.add(k);
      renderAll();
    });
  });
  tbody.querySelectorAll('tr.row-dong').forEach(tr => {
    tr.addEventListener('click', () => {
      const lat = parseFloat(tr.dataset.lat);
      const lng = parseFloat(tr.dataset.lng);
      if (!lat || !lng) return;
      pendingMapFocus = {
        g: { label: tr.dataset.dong, sub: `${tr.dataset.sigungu} · ${tr.dataset.sido}`, coords: [lat, lng] },
        level: 'dong'
      };
      switchTab('map');
    });
  });
}

function renderAll() {
  const data = getFiltered();
  renderTreeTable(data);
  if (mapInitialized && leafletMap) updateMap(data);
}

// ── 모두 펼치기 / 접기 ───────────────────────
function expandAll() {
  collapsedSido.clear();
  collapsedSigungu.clear();
  renderAll();
}

function collapseAll() {
  const grouped = groupData(getFiltered());
  grouped.forEach((sidoMap, sido) => {
    collapsedSido.add(sido);
    sidoMap.forEach((_, sigungu) => collapsedSigungu.add(`${sido}|||${sigungu}`));
  });
  renderAll();
}

// ── 지도 ─────────────────────────────────────
function initMap() {
  leafletMap = L.map('map-container').setView([36.5, 127.8], 7);
  const VWORLD_KEY = 'D1F79AEF-C13E-3AE7-9018-4EACD74A5B54';
  const baseLayer = L.tileLayer(
    `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Base/{z}/{y}/{x}.png`,
    { maxZoom: 19, attribution: '© <a href="https://www.vworld.kr">Vworld</a>' }
  );
  const satelliteLayer = L.tileLayer(
    `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Satellite/{z}/{y}/{x}.jpeg`,
    { maxZoom: 19, attribution: '© <a href="https://www.vworld.kr">Vworld</a>' }
  );
  const hybridLayer = L.tileLayer(
    `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Hybrid/{z}/{y}/{x}.png`,
    { maxZoom: 19, attribution: '© <a href="https://www.vworld.kr">Vworld</a>' }
  );
  baseLayer.addTo(leafletMap);
  L.control.layers(
    { '기본지도': baseLayer, '위성': satelliteLayer, '위성+라벨': L.layerGroup([satelliteLayer, hybridLayer]) },
    {}, { position: 'topright' }
  ).addTo(leafletMap);
  leafletMap.on('zoomend', () => {
    updateMap(getFiltered());
    updateZoomInfo();
  });

  // 체크박스 이벤트 연결
  const cbMap = { 'cb-sido': 'sido', 'cb-sg': 'sg', 'cb-dong': 'dong' };
  Object.entries(cbMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
      levelChecks[key] = el.checked;
      updateMap(getFiltered());
      updateZoomInfo();
    });
  });

  syncCheckboxUI();
  updateZoomInfo();
  leafletMap.on('click', () => {
    if (activeBoundary) { leafletMap.removeLayer(activeBoundary); activeBoundary = null; }
  });
  updateMap(getFiltered());
}

function updateZoomInfo() {
  const el = document.getElementById('map-zoom-info');
  if (!el || !leafletMap) return;
  const z = leafletMap.getZoom();
  const parts = [];
  if (levelChecks.sido) parts.push('도/시');
  if (levelChecks.sg)   parts.push('시/군/구');
  if (levelChecks.dong) parts.push('동/읍/면');
  el.textContent = `줌: ${z} | ${parts.length ? parts.join('+') : '없음'}`;
}

function updateMap(data) {
  if (!leafletMap) return;

  mapMarkers.forEach(m => leafletMap.removeLayer(m));
  if (activeBoundary) { leafletMap.removeLayer(activeBoundary); activeBoundary = null; }
  boundaryFetchId++;
  mapMarkers = [];

  const hasDongCoords = data.some(d => d.lat && d.lng && d.dong !== d.sigungu);

  // ── 레벨별 groups 빌드 ────────────────────────
  // layerDefs: [{ level, groups, maxR, minR, fontSize, nameFontSize }]
  const layerDefs = [];

  // 도/시 레벨
  if (levelChecks.sido) {
    const groups = new Map();
    const sgMap = new Map();
    data.forEach(d => {
      const key = `${d.sido}__${d.sigungu}`;
      if (!sgMap.has(key)) sgMap.set(key, { sido: d.sido, pop60: 0, pop70: 0, population: 0, hasSummary: false });
      const sg = sgMap.get(key);
      if (d.dong === d.sigungu) {
        sg.pop60 = d.pop60_69 || 0; sg.pop70 = d.pop70_79 || 0;
        sg.population = d.population || 0; sg.hasSummary = true;
      } else if (!sg.hasSummary) {
        sg.pop60 += d.pop60_69 || 0; sg.pop70 += d.pop70_79 || 0;
        sg.population += d.population || 0;
      }
    });
    sgMap.forEach(sg => {
      if (!groups.has(sg.sido)) {
        const sidoGeo = GEO[sg.sido];
        groups.set(sg.sido, { label: sg.sido, sub: '', pop60: 0, pop70: 0, population: 0, coords: sidoGeo ? sidoGeo.c : null });
      }
      const g = groups.get(sg.sido);
      g.pop60 += sg.pop60; g.pop70 += sg.pop70; g.population += sg.population;
    });
    layerDefs.push({ level: 'sido', groups, maxR: 100, minR: 50, fontSize: 13, nameFontSize: 10 });
  }

  // 시/군/구 레벨
  if (levelChecks.sg || (levelChecks.dong && !hasDongCoords)) {
    const groups = new Map();
    data.forEach(d => {
      const key = `${d.sido}__${d.sigungu}`;
      if (!groups.has(key)) {
        groups.set(key, { label: d.sigungu || d.sido, sub: d.sido, pop60: 0, pop70: 0, population: 0, hasSummary: false, coords: null });
      }
      const g = groups.get(key);
      if (d.dong === d.sigungu) {
        g.pop60 = d.pop60_69 || 0; g.pop70 = d.pop70_79 || 0;
        g.population = d.population || 0; g.hasSummary = true;
      } else if (!g.hasSummary) {
        g.pop60 += d.pop60_69 || 0; g.pop70 += d.pop70_79 || 0;
        g.population += d.population || 0;
      }
      if (!g.coords) g.coords = getCoords(d.sido, d.sigungu);
    });
    layerDefs.push({ level: 'sigungu', groups, maxR: 80, minR: 30, fontSize: 11, nameFontSize: 9 });
  }

  // 동/읍/면 레벨
  if (levelChecks.dong && hasDongCoords) {
    const groups = new Map();
    data.forEach(d => {
      if (!d.lat || !d.lng || d.dong === d.sigungu) return;
      // 구/시/군으로 끝나는 요약행 제외 (예: 부천시 내 소사구 행)
      if (/[구시군]$/.test(d.dong || '')) return;
      const key = `${d.sido}__${d.sigungu}__${d.dong}`;
      groups.set(key, {
        label: d.dong,
        sub:   `${d.sigungu} · ${d.sido}`,
        pop60: d.pop60_69   || 0,
        pop70: d.pop70_79   || 0,
        population: d.population || 0,
        coords: [d.lat, d.lng]
      });
    });
    layerDefs.push({ level: 'dong', groups, maxR: 60, minR: 20, fontSize: 10, nameFontSize: 8 });
  }

  // ── 레이어별 마커 렌더링 ──────────────────────
  function getPopColor(p) {
    if (p <  1000) return { fill: '#a8d0f0', border: '#6aaad8' };
    if (p <  2000) return { fill: '#5b9fd6', border: '#3a7fba' };
    if (p <  3000) return { fill: '#2e75b6', border: '#1a5490' };
    if (p <  4000) return { fill: '#1a4fa0', border: '#0f3070' };
                   return { fill: '#0d2e6b', border: '#081a40' };
  }

  layerDefs.forEach(({ level, groups, maxR, minR, fontSize, nameFontSize }) => {
    const allPops = [...groups.values()].filter(g => g.coords).map(g => g.population);
    const maxPop = allPops.length ? Math.max(...allPops) : 1;
    const minPop = allPops.length ? Math.min(...allPops) : 0;

    groups.forEach(g => {
      if (!g.coords) return;

      const pop = g.population;
      const radius = maxPop === minPop
        ? maxR
        : Math.round(minR + (maxR - minR) * (pop - minPop) / (maxPop - minPop));
      const diameter = radius * 2;
      const { fill, border } = getPopColor(pop);

      let popLabel;
      if (pop >= 100000)     popLabel = (pop / 10000).toFixed(0) + '만';
      else if (pop >= 10000) popLabel = (pop / 10000).toFixed(1) + '만';
      else                   popLabel = pop.toLocaleString();

      const icon = L.divIcon({
        html: `<div style="width:${diameter}px;height:${diameter}px;border-radius:50%;background:${fill};border:2px solid ${border};display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:'Malgun Gothic',sans-serif;text-align:center;box-sizing:border-box;text-shadow:0 1px 2px rgba(0,0,0,0.4);padding:4px;overflow:hidden;">
          <span style="font-size:${nameFontSize}px;opacity:0.9;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${g.label}</span>
          <span style="font-size:${fontSize}px;font-weight:bold;line-height:1.2;">${popLabel}</span>
        </div>`,
        className: '',
        iconSize:   [diameter, diameter],
        iconAnchor: [radius,   radius]
      });

      const marker = L.marker(g.coords, { icon }).bindPopup(`
        <div style="font-family:'Malgun Gothic',Arial,sans-serif;font-size:13px;min-width:160px">
          <b style="color:#1a4fa0;font-size:14px">${g.label}</b><br>
          <span style="color:#888;font-size:11px">${g.sub}</span>
          <hr style="margin:6px 0;border:none;border-top:1px solid #dde3ef">
          60-69세 여성: <b>${g.pop60.toLocaleString()}</b>명<br>
          70-79세 여성: <b>${g.pop70.toLocaleString()}</b>명<br>
          <div style="margin-top:4px;padding-top:4px;border-top:1px solid #dde3ef">
            합계: <b style="color:#1a4fa0;font-size:14px">${g.population.toLocaleString()}</b>명
          </div>
        </div>
      `)
      .on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        fetchBoundary(g, level);
      })
      .addTo(leafletMap);

      mapMarkers.push(marker);
    });
  });
}

// ── 경계선 ────────────────────────────────────
async function fetchBoundary(g, level) {
  if (activeBoundary) { leafletMap.removeLayer(activeBoundary); activeBoundary = null; }

  const myId = ++boundaryFetchId;
  const cacheKey = `${level}__${g.label}__${g.sub}`;
  if (cacheKey in boundaryCache) {
    if (myId !== boundaryFetchId) return;
    if (boundaryCache[cacheKey]) drawBoundary(boundaryCache[cacheKey]);
    return;
  }

  // ── 내장 경계 우선 사용 (모든 레벨) ──
  if (window.BOUNDARY_CACHE && cacheKey in window.BOUNDARY_CACHE) {
    boundaryCache[cacheKey] = window.BOUNDARY_CACHE[cacheKey];
    if (myId !== boundaryFetchId) return;
    drawBoundary(window.BOUNDARY_CACHE[cacheKey]);
    return;
  }

  // 레벨별 레이어 및 필터 필드 결정
  let dataLayer, filterField;
  if (level === 'sido') {
    dataLayer = 'LT_C_ADSIDO_INFO';
    filterField = 'ctp_kor_nm';
  } else if (level === 'sigungu') {
    dataLayer = 'LT_C_ADSIGG_INFO';
    filterField = 'sig_kor_nm';
  } else {
    dataLayer = 'LT_C_ADEMD_INFO';
    filterField = 'emd_kor_nm';
  }

  // file:// 이외 환경(localhost, Vercel 등)에서는 /api/vworld 프록시 사용
  const isLocalServer = location.protocol !== 'file:';

  if (isLocalServer) {
    // ── server.py / Vercel: Vworld 프록시 (전국 완벽 지원) ──

    // 행정동 번호 제거 폴백 목록: "영통3동" → ["영통3동", "영통동"]
    const labelFallbacks = [g.label];
    const stripped = g.label.replace(/(\D+)\d+(동|읍|면)$/, '$1$2');
    if (stripped !== g.label) labelFallbacks.push(stripped);

    for (const labelTry of labelFallbacks) {
      const params = `?service=data&request=GetFeature&data=${dataLayer}&attrFilter=${filterField}:=:${encodeURIComponent(labelTry)}&format=json&size=10&key=${VWORLD_KEY}`;
      try {
        const resp = await fetch(`/api/vworld${params}`);
        const data = await resp.json();
        if (data.response.status !== 'OK') continue;

        let features = data.response.result.featureCollection.features;
        if (features.length > 1 && g.sub) {
          const subParts = g.sub.replace(' · ', ' ').split(' ').filter(Boolean);
          const filtered = features.filter(f => subParts.some(s => (f.properties.full_nm || '').includes(s)));
          if (filtered.length > 0) features = filtered;
        }
        const geojson = { type: 'FeatureCollection', features: features.map(f => ({ type: 'Feature', geometry: f.geometry, properties: f.properties })) };
        boundaryCache[cacheKey] = geojson;
        if (myId !== boundaryFetchId) return;
        drawBoundary(geojson);
        return;
      } catch (e) {
        console.warn('[경계] Vworld 실패:', e.message);
      }
    }
    boundaryCache[cacheKey] = null;

  } else {
    // ── file:// 직접 실행: Nominatim 폴백 (CORS 지원, 일부 누락 가능) ──
    const subClean = (g.sub || '').replace(' · ', ' ');
    const labelNorm = g.label.replace(/제(\d+)(동|가)$/, '$1$2');
    const normalized = labelNorm !== g.label;
    const queries = [
      [g.label, subClean, '대한민국'].filter(Boolean).join(' '),
      ...(normalized ? [[labelNorm, subClean, '대한민국'].filter(Boolean).join(' ')] : []),
      [g.label, subClean].filter(Boolean).join(' '),
      g.label,
    ];
    for (const q of queries) {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=geojson&polygon_geojson=1&limit=5&accept-language=ko&countrycodes=kr`;
      try {
        const resp = await fetch(url, { headers: { 'User-Agent': 'jumin-population-collector/1.0' } });
        const geojson = await resp.json();
        const hit = geojson.features?.find(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon');
        if (hit) {
          const result = { type: 'FeatureCollection', features: [hit] };
          boundaryCache[cacheKey] = result;
          if (myId !== boundaryFetchId) return;
          drawBoundary(result);
          return;
        }
      } catch (e) { console.warn('[경계] Nominatim 실패:', e.message); }
    }
    boundaryCache[cacheKey] = null;
  }
}

function drawBoundary(geojson) {
  activeBoundary = L.geoJSON(geojson, {
    style: {
      color: '#1a4fa0',
      weight: 2.5,
      fillColor: '#4a7fd4',
      fillOpacity: 0.15
    }
  }).addTo(leafletMap);
}


// ── 탭 전환 ──────────────────────────────────
function switchTab(tabName) {
  activeTab = tabName;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === 'tab-' + tabName);
  });

  // 표 탭에서만 트리 조작 버튼 표시
  const treeCtrl = document.getElementById('tree-ctrl-group');
  if (treeCtrl) treeCtrl.style.display = tabName === 'table' ? '' : 'none';

  if (tabName === 'map') {
    if (!mapInitialized) {
      mapInitialized = true;
      setTimeout(() => { initMap(); applyPendingMapFocus(); }, 50);
    } else {
      setTimeout(() => {
        leafletMap && leafletMap.invalidateSize();
        updateMap(getFiltered());
        applyPendingMapFocus();
      }, 50);
    }
  }
}

function applyPendingMapFocus() {
  if (!pendingMapFocus || !leafletMap) return;
  const { g, level } = pendingMapFocus;
  pendingMapFocus = null;
  leafletMap.setView(g.coords, 15);
  fetchBoundary(g, level);
}

// ── 이벤트 등록 ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  document.getElementById('btn-expand-all').addEventListener('click', expandAll);
  document.getElementById('btn-collapse-all').addEventListener('click', collapseAll);

  document.getElementById('f-sido').addEventListener('change', (e) => {
    buildSigungu(e.target.value);
    renderAll();
  });
  document.getElementById('f-sigungu').addEventListener('change', (e) => {
    buildDong(document.getElementById('f-sido').value, e.target.value);
    renderAll();
  });
  document.getElementById('f-dong').addEventListener('change', renderAll);

  // 탭 전환
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 정렬 헤더 클릭
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortCol === col) {
        sortDir *= -1;
      } else {
        sortCol = col;
        sortDir = col === 'name' ? 1 : -1;  // 이름은 기본 오름차순, 숫자는 내림차순
      }
      updateSortIcons();
      renderAll();
    });
  });

  updateSortIcons();

  // 다른 탭에서 데이터 저장 시 자동 갱신
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.populationData) {
      allData = changes.populationData.newValue || [];
      buildFilters();
      renderAll();
    }
  });
});
