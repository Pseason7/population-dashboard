"""
대시보드.html 빌드 스크립트
extension/ 폴더의 파일들을 하나의 standalone HTML로 합칩니다.
사용법: python build.py
"""
import re, os

BASE = os.path.dirname(os.path.abspath(__file__))
EXT  = os.path.join(BASE, 'extension')

def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()

def to_standalone_js(src):
    # loadData
    src = src.replace(
        "function loadData() {\n  chrome.storage.local.get(['populationData'], (result) => {\n    allData = result.populationData || [];\n    buildFilters();\n    collapseAll();  // 기본값: 모두 닫힘\n  });\n}",
        "function loadData() {\n  const stored = localStorage.getItem('populationData');\n  allData = stored ? JSON.parse(stored) : (window.POP_DATA || []);\n  buildFilters();\n  collapseAll();\n}"
    )
    # onChanged 제거
    src = re.sub(
        r"\n  // 다른 탭에서 데이터 저장 시 자동 갱신\n  chrome\.storage\.onChanged\.addListener.*?\}\);\n",
        "\n", src, flags=re.DOTALL
    )
    return src

js  = to_standalone_js(read(os.path.join(EXT, 'dashboard.js')))
css = read(os.path.join(EXT, 'dashboard.css'))
leaflet_js  = read(os.path.join(EXT, 'leaflet.js'))
leaflet_css = read(os.path.join(EXT, 'leaflet.css'))
ext_html = read(os.path.join(EXT, 'dashboard.html'))

# 인구 데이터 내장
pop_path = os.path.join(BASE, 'population_202601.json')
if os.path.exists(pop_path):
    pop_data = read(pop_path)
    pop_script = f'window.POP_DATA={pop_data};'
    print(f'  인구 데이터: {len(pop_data)//1024}KB')
else:
    pop_script = 'window.POP_DATA=[];'
    print('  ⚠️  population_202601.json 없음')

# 행정동 경계 데이터 내장
boundary_path = os.path.join(BASE, 'boundaries.json')
if os.path.exists(boundary_path):
    boundary_data = read(boundary_path)
    boundary_script = f'window.BOUNDARY_CACHE={boundary_data};'
    print(f'  경계 데이터: {len(boundary_data)//1024}KB')
else:
    boundary_script = 'window.BOUNDARY_CACHE={};'
    print('  ⚠️  boundaries.json 없음 (python fetch_boundaries.py 먼저 실행)')

body = re.search(r'<body>(.*?)</body>', ext_html, re.DOTALL).group(1)
body = re.sub(r'\s*<link[^>]+>\s*', '\n', body)
body = re.sub(r'\s*<script[^>]+></script>\s*', '\n', body)

out = f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>인구통계 대시보드</title>
  <style>
{leaflet_css}
{css}
  </style>
</head>
<body>
{body.strip()}
  <script>
{pop_script}
  </script>
  <script>
{boundary_script}
  </script>
  <script>
{leaflet_js}
  </script>
  <script>
{js}
  </script>
</body>
</html>"""

out_path = os.path.join(BASE, '대시보드.html')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(out)

# Vercel 배포용 index.html도 동시 생성
index_path = os.path.join(BASE, 'index.html')
with open(index_path, 'w', encoding='utf-8') as f:
    f.write(out)

print(f"✅ 빌드 완료: 대시보드.html + index.html ({len(out)//1024}KB)")
