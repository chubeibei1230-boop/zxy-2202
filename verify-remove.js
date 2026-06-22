const http = require('http');

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8161,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function test() {
  // 登录 admin
  const loginRes = await request('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123'
  });
  const token = loginRes.token;

  // 查看课程5的候补名单
  const listRes = await request('GET', '/api/waitlists/course/5', null, token);
  const waitlists = listRes.waitlists || [];
  console.log('课程5候补名单 (共' + waitlists.length + '条活跃记录):');
  waitlists.forEach(w => {
    const userName = w.user ? w.user.name : '未知';
    console.log('  - ID:', w.id, '|', userName, '| 状态:', w.status, '| 排名:', w.display_rank || '-');
  });

  // 查看候补日志
  const logsRes = await request('GET', '/api/waitlists/course/5/logs', null, token);
  const logs = logsRes.logs || logsRes || [];
  console.log('');
  console.log('最近候补日志:');
  logs.slice(0, 5).forEach(log => {
    const actionBy = log.action_by || '系统';
    console.log('  -', log.action, '| 操作人:', actionBy, '| 时间:', log.created_at);
    if (log.details) {
      console.log('    详情:', log.details);
    }
  });
}

test().catch(console.error);
