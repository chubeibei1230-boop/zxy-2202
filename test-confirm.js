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
  console.log('=== 候补确认流程测试 ===\n');

  // 1. 登录 student2
  console.log('1. 登录 student2...');
  const loginRes = await request('POST', '/api/auth/login', {
    username: 'student2',
    password: 'student123'
  });
  const token = loginRes.token;
  console.log('登录成功');
  console.log('');

  // 2. 查看当前候补列表
  console.log('2. 查看 student2 的候补列表...');
  const waitlistRes = await request('GET', '/api/waitlists/my', null, token);
  const notifiedItem = waitlistRes.waitlists.find(w => w.status === 'notified');
  if (notifiedItem) {
    console.log('找到待确认候补:', notifiedItem.course.title);
    console.log('  状态:', notifiedItem.status);
    console.log('  确认截止:', notifiedItem.expires_at);
    console.log('  候补ID:', notifiedItem.id);
  } else {
    console.log('没有待确认的候补');
    console.log('所有候补:');
    waitlistRes.waitlists.forEach(w => {
      console.log('  -', w.course.title, '|', w.status);
    });
    return;
  }
  console.log('');

  // 3. 确认候补转正式预约
  console.log('3. 确认候补转为正式预约...');
  const confirmRes = await request('POST', `/api/waitlists/${notifiedItem.id}/confirm`, null, token);
  console.log('确认结果:', JSON.stringify(confirmRes));
  console.log('');

  // 4. 再次查看候补列表
  console.log('4. 确认后查看候补列表...');
  const waitlistRes2 = await request('GET', '/api/waitlists/my', null, token);
  waitlistRes2.waitlists.forEach(w => {
    console.log('  -', w.course.title, '| 状态:', w.status);
  });
  console.log('');

  // 5. 查看预约列表
  console.log('5. 查看 student2 的预约列表...');
  const bookingsRes = await request('GET', '/api/bookings/mine', null, token);
  console.log('预约列表:');
  const bookings = bookingsRes.bookings || bookingsRes || [];
  if (Array.isArray(bookings)) {
    bookings.forEach(b => {
      const courseName = b.course ? b.course.title : b.course_name || '未知课程';
      console.log('  -', courseName, '| 状态:', b.status);
    });
  } else {
    console.log('  返回数据格式:', typeof bookingsRes);
    console.log('  数据:', JSON.stringify(bookingsRes).substring(0, 300));
  }
  console.log('');

  // 6. 查看课程详情，确认已预约人数变化
  console.log('6. 查看课程5详情...');
  const courseRes = await request('GET', '/api/courses/5', null, token);
  const course = courseRes.course || courseRes;
  console.log('  课程名:', course.title);
  console.log('  状态:', course.status);
  console.log('  容量:', course.capacity);
  console.log('  已预约:', course.booked_count);
  console.log('  候补人数:', course.waitlist_count);
  console.log('');

  console.log('=== 测试完成 ===');
}

test().catch(console.error);
