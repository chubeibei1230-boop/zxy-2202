const http = require('http');

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8161,
      path: '/api/waitlists' + path,
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

function requestGeneral(method, path, data = null, token = null) {
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
  console.log('=== 候补功能测试 ===\n');

  // 1. 登录 student2
  console.log('1. 登录 student2...');
  const loginRes = await requestGeneral('POST', '/api/auth/login', {
    username: 'student2',
    password: 'student123'
  });
  console.log('登录结果:', loginRes.message || '成功');
  const student2Token = loginRes.token;
  console.log('student2 token:', student2Token ? '已获取' : '失败');
  console.log('');

  if (!student2Token) {
    console.log('登录失败，退出测试');
    return;
  }

  // 2. 查看课程5详情
  console.log('2. 查看课程5详情...');
  const courseRes = await requestGeneral('GET', '/api/courses/5', null, student2Token);
  const course = courseRes.course || courseRes;
  console.log('课程名称:', course.title || course.name);
  console.log('课程状态:', course.status);
  console.log('容量:', course.capacity);
  console.log('已预约:', course.booked_count);
  console.log('候补人数:', course.waitlist_count);
  console.log('');

  // 3. student2 加入候补
  console.log('3. student2 加入课程5候补...');
  const joinRes = await request('POST', '/course/5/join', null, student2Token);
  console.log('加入候补结果:', JSON.stringify(joinRes));
  console.log('');

  // 4. 查看我的候补列表
  console.log('4. 查看 student2 的候补列表...');
  const myWaitlistRes = await request('GET', '/my', null, student2Token);
  console.log('候补列表:', JSON.stringify(myWaitlistRes, null, 2).substring(0, 500));
  console.log('');

  // 5. 查看候补统计
  console.log('5. 查看 student2 的候补统计...');
  const statsRes = await request('GET', '/stats/summary', null, student2Token);
  console.log('统计数据:', JSON.stringify(statsRes, null, 2));
  console.log('');

  // 6. 登录 student1
  console.log('6. 登录 student1...');
  const login1Res = await requestGeneral('POST', '/api/auth/login', {
    username: 'student1',
    password: 'student123'
  });
  const student1Token = login1Res.token;
  console.log('student1 token:', student1Token ? '已获取' : '失败');
  console.log('');

  // 7. student1 取消预约
  console.log('7. student1 取消课程5的预约...');
  const cancelRes = await requestGeneral('POST', '/api/bookings/cancel/5', null, student1Token);
  console.log('取消预约结果:', JSON.stringify(cancelRes));
  console.log('');

  // 8. 再次查看 student2 的候补列表和统计
  console.log('8. 取消后查看 student2 的候补状态...');
  const myWaitlistRes2 = await request('GET', '/my', null, student2Token);
  console.log('候补列表:', JSON.stringify(myWaitlistRes2, null, 2).substring(0, 800));
  console.log('');

  const statsRes2 = await request('GET', '/stats/summary', null, student2Token);
  console.log('统计数据:', JSON.stringify(statsRes2, null, 2));
  console.log('');

  // 9. 如果有 notified 状态的候补，进行确认
  const waitlists = Array.isArray(myWaitlistRes2) ? myWaitlistRes2 : (myWaitlistRes2.waitlists || []);
  const notifiedItem = waitlists.find(w => w.status === 'notified');
  if (notifiedItem) {
    console.log('9. student2 确认候补转为正式预约...');
    const confirmRes = await request('POST', `/${notifiedItem.id}/confirm`, null, student2Token);
    console.log('确认结果:', JSON.stringify(confirmRes));
    console.log('');

    // 10. 查看 student2 的预约列表
    console.log('10. 查看 student2 的预约列表...');
    const bookingsRes = await requestGeneral('GET', '/api/bookings/mine', null, student2Token);
    console.log('预约列表:', JSON.stringify(bookingsRes, null, 2).substring(0, 500));
    console.log('');
  } else {
    console.log('9. 没有待确认的候补通知');
    console.log('');
  }

  console.log('=== 测试完成 ===');
}

test().catch(console.error);
