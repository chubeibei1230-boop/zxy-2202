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
  console.log('=== 管理员端候补管理测试 ===\n');

  // 1. 登录 admin
  console.log('1. 登录 admin...');
  const loginRes = await request('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123'
  });
  const token = loginRes.token;
  console.log('登录成功，角色:', loginRes.user?.role);
  console.log('');

  // 2. 查看课程5的候补名单
  console.log('2. 查看课程5的候补名单...');
  const waitlistRes = await request('GET', '/api/waitlists/course/5', null, token);
  console.log('候补列表:');
  const waitlists = waitlistRes.waitlists || waitlistRes || [];
  if (Array.isArray(waitlists)) {
    waitlists.forEach(w => {
      const userName = w.user ? w.user.name : '未知';
      console.log('  -', userName, '| 状态:', w.status, '| 加入时间:', w.joined_at);
      if (w.removed_reason) {
        console.log('    移除原因:', w.removed_reason);
      }
    });
  } else {
    console.log('  返回数据:', JSON.stringify(waitlistRes).substring(0, 300));
  }
  console.log('');

  // 3. 查看课程5的候补统计
  console.log('3. 查看课程5的候补统计...');
  const statsRes = await request('GET', '/api/waitlists/stats/summary', null, token);
  console.log('统计数据:', JSON.stringify(statsRes, null, 2));
  console.log('');

  // 4. 查看课程5的候补日志
  console.log('4. 查看课程5的候补处理日志...');
  const logsRes = await request('GET', '/api/waitlists/course/5/logs', null, token);
  console.log('日志列表:');
  const logs = logsRes.logs || logsRes || [];
  if (Array.isArray(logs)) {
    logs.slice(0, 5).forEach(log => {
      console.log('  -', log.action, '| 操作人:', log.action_by || '系统', '| 时间:', log.created_at);
      if (log.details) {
        console.log('    详情:', log.details);
      }
    });
    if (logs.length > 5) {
      console.log('  ... 共', logs.length, '条记录');
    }
  } else {
    console.log('  返回数据:', JSON.stringify(logsRes).substring(0, 300));
  }
  console.log('');

  console.log('=== 测试完成 ===');
}

test().catch(console.error);
