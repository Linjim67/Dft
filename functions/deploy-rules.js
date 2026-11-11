/* ═══════════════════════════════════════════════════════════════
   部署 Firestore 規則（不需要 Firebase CLI、不需要 Blaze）

     node functions/deploy-rules.js ./keys/dftt-admin.json --dry-run   只比對，不部署
     node functions/deploy-rules.js ./keys/dftt-admin.json             部署

   - 部署的是 git 已經 commit 的 firestore.rules（HEAD），不是工作目錄：
     別的 session 改到一半、還沒 commit 的規則不會被一起推上線。
     工作目錄和 HEAD 不一樣時會提醒。
   - 先抓線上正在用的規則，和 HEAD 比對（用 diff -u 印出來）；一樣就不部署。
   - 部署 = 建立新的 ruleset（伺服器在這一步編譯，有錯就停，線上完全不受影響）
     → 把 cloud.firestore 這個 release 指到新的 ruleset。
   - 服務帳戶金鑰在 keys/（.gitignore），用法和 archive-now.js 一樣。
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { GoogleAuth } = require('google-auth-library');

const API = 'https://firebaserules.googleapis.com/v1/';

function die(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}

async function main() {
  const keyPath = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!keyPath || keyPath.startsWith('--')) {
    die('用法：node functions/deploy-rules.js <服務帳戶金鑰.json> [--dry-run]');
  }
  const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  const project = key.project_id;
  const repo = path.resolve(__dirname, '..');

  /* 1. 要部署的內容：HEAD 的 firestore.rules */
  const head = execFileSync('git', ['-C', repo, 'show', 'HEAD:firestore.rules'], { encoding: 'utf8' });
  const work = fs.readFileSync(path.join(repo, 'firestore.rules'), 'utf8');
  const commit = execFileSync('git', ['-C', repo, 'log', '-1', '--format=%h %s', '--', 'firestore.rules'],
    { encoding: 'utf8' }).trim();
  console.log('專案：' + project);
  console.log('要部署：HEAD 的 firestore.rules（最後一次修改：' + commit + '）');
  if (work !== head) {
    console.log('⚠ 工作目錄的 firestore.rules 有還沒 commit 的修改，這些不會被部署。');
  }

  const auth = new GoogleAuth({ keyFile: keyPath, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const releaseName = 'projects/' + project + '/releases/cloud.firestore';

  /* 2. 線上正在用的規則 */
  const rel = (await client.request({ url: API + releaseName })).data;
  const live = (await client.request({ url: API + rel.rulesetName })).data.source.files[0].content;
  console.log('線上：' + rel.rulesetName.split('/').pop() + '（' + rel.updateTime + '）');

  if (live === head) {
    console.log('✓ 線上已經是這個版本，不用部署。');
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-'));
  fs.writeFileSync(path.join(tmp, 'live.rules'), live);
  fs.writeFileSync(path.join(tmp, 'head.rules'), head);
  console.log('\n── 線上 → HEAD 的差異 ──');
  const d = spawnSync('diff', ['-u', '--label', 'live', '--label', 'HEAD',
    path.join(tmp, 'live.rules'), path.join(tmp, 'head.rules')], { encoding: 'utf8' });
  process.stdout.write(d.stdout || '(沒有 diff 指令，略過差異)\n');

  if (dryRun) {
    console.log('\n--dry-run：沒有部署。');
    return;
  }

  /* 3. 建立 ruleset：伺服器在這裡編譯，有錯就停 */
  let ruleset;
  try {
    ruleset = (await client.request({
      url: API + 'projects/' + project + '/rulesets', method: 'POST',
      data: { source: { files: [{ name: 'firestore.rules', content: head }] } }
    })).data;
  } catch (e) {
    const issues = e.response && e.response.data && e.response.data.error;
    die('規則編譯失敗，線上沒有任何改變：\n' + JSON.stringify(issues, null, 2));
  }
  console.log('\n✓ 編譯成功：' + ruleset.name.split('/').pop());

  /* 4. 上線：release 指到新的 ruleset */
  const out = (await client.request({
    url: API + releaseName, method: 'PATCH',
    data: { release: { name: releaseName, rulesetName: ruleset.name } }
  })).data;
  console.log('✓ 已上線：' + out.rulesetName.split('/').pop() + '（' + out.updateTime + '）');
}

main().catch((e) => {
  const r = e.response;
  die(r ? r.status + ' ' + JSON.stringify(r.data).slice(0, 600) : e.message);
});
