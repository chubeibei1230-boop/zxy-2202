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
  console.log('=== 管理员移除候补测试 ===\n');

  // 1. 登录 student1
  console.log('1. 登录 student1...');
  const s1Login = await request('POST', '/api/auth/login', {
    username: 'student1',
    password: 'student123'
  });
  const s1Token = s1Login.token;
  console.log('登录成功');
  console.log('');

  // 2. student1 加入课程5候补
  console.log('2. student1 加入课程5候补...');
  const joinRes = await request('POST', '/api/waitlists/course/5/join', null, s1Token);
  console.log('加入结果:', joinRes.message || '成功');
  if (joinRes.waitlist) {
    console.log('  状态:', joinRes.waitlist.status);
    console.log('  排名:', joinRes.waitlist.position);
    console.log('  候补ID:', joinRes.waitlist.id);
  }
  console.log('');

  // 3. 登录 admin
  console.log('3. 登录 admin...');
  const adminLogin = await request('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123'
  });
  const adminToken = adminLogin.token;
  console.log('登录成功');
  console.log('');

  // 4. 查看课程5的候补名单
  console.log('4. 管理员查看课程5候补名单...');
  const listRes = await request('GET', '/api/waitlists/course/5', null, adminToken);
  console.log('返回类型:', typeof listRes);
  console.log('返回数据:', JSON.stringify(listRes));
  const waitlists = listRes.waitlists || [];
  console.log('候补名单 (共' + waitlists.length + '条):');
  waitlists.forEach(w => {
    const userName = w.user ? w.user.name : '未知';
    console.log('  - ID:', w.id, '|', userName, '| 状态:', w.status);
  });
  console.log('');

  // 5. 找到 waiting 状态的候补记录
  const waitingItem = waitlists.find(w => w.status === 'waiting');
  if (!waitingItem) {
    console.log('没有找到 waiting 状态的候补记录，无法测试移除');
    return;
  }
  console.log('5. 找到待移除的候补记录: ID =', waitingItem.id);
  console.log('');

  // 6. 管理员移除候补
  console.log('6. 管理员移除该候补记录（原因：不符合条件）...');
  const removeRes = await request('DELETE', `/api/waitlists/${waitingItem.id}/admin-remove`, {
    reason: '不符合条件',
    remark: '测试管理员移除功能'
  }, adminToken);
  console.log('移除结果:', JSON.stringify(removeRes));
  console.log('');

  // 7. 再次查看候补名单
  console.log('7. 移除后查看候补名单...');
  const listRes2 = await request('GET', '/api/waitlists/course/5', null, adminToken);
  const waitlists2 = listRes2.waitlists || listRes2 || [];
  console.log('候补名单:');
  waitlists2.forEach(w => {
    const userName = w.user ? w.user.name : '未知';
    console.log('  - ID:', w.id, '|', userName, '| 状态:', w.status);
    if (w.removed_reason) {
      console.log('    移除原因:', w.removed_reason);
    }
  });
  console.log('');

  // 8. 查看候补日志
  console.log('8. 查看候补处理日志...');
  const logsRes = await request('GET', '/api/waitlists/course/5/logs', null, adminToken);
  const logs = logsRes.logs || logsRes || [];
  console.log('最近日志:');
  logs.slice(0, 3).forEach(log => {
    console.log('  -', log.action, '| 操作人:', log.action_by || '系统');
    if (log.details) {
      console.log('    详情:', log.details);
    }
  });
  console.log('');

  console.log('=== 测试完成 ===');
}

test().catch(console.error);
