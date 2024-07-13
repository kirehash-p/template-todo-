import escapeHTML from "escape-html";

export function todo_to_html(todo) {
  let todo_deadline_str = "";
  if (todo.deadline) {
    if (todo.deadline_include_time) {
      todo_deadline_str =
        todo.deadline.toISOString().slice(0, 10) +
        " " +
        todo.deadline.toISOString().slice(11, 16);
    } else {
      todo_deadline_str = todo.deadline.toISOString().slice(0, 10);
    }
  }
  return `
  <tr data-id="${todo.id}">
    <td class="border border-gray-300 py-2 px-4">${escapeHTML(todo.title)}</td>
    <td class="border border-gray-300 py-2 px-4">${todo_deadline_str}</td>
    <td class="border border-gray-300 py-2 px-4">
      <div class="flex gap-2">
          <form action="/delete" method="post" class="delete-form">
              <input type="hidden" name="id" value="${todo.id}">
              <input type="hidden" name="type" value="todo">
              <button type="submit" class="py-1 px-2 bg-red-500 text-white rounded hover:bg-red-600">削除</button>
          </form>
          <form action="/completed" method="post" class="completed-form">
              <input type="hidden" name="id" value="${todo.id}">
              <button type="submit" class="py-1 px-2 bg-blue-500 text-white rounded hover:bg-blue-600">完了</button>
          </form>
          <button type="button" class="py-1 px-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 edit-button">編集</button>
          <form action="/update" method="post" class="hidden update-form" onsubmit="return validate_form(this);>
              <input type="hidden" name="id" value="${todo.id}">
              <input type="hidden" name="todo_title" value="${escapeHTML(
                todo.title
              )}">
              <input type="date" name="todo_deadline_date" class="hidden form-date-YYMMDD">
              <input type="time" name="todo_deadline_time" class="hidden form-time-HHMM">
          </form>
      </div>
    </td>
  </tr>
`;
}

export function completed_to_html(completed) {
  let completed_at_str =
    completed.completedAt.toISOString().slice(0, 10) +
    " " +
    completed.completedAt.toISOString().slice(11, 16);
  return `
    <tr>
      <td class="border border-gray-300 py-2 px-4">${escapeHTML(
        completed.title
      )}</td>
      <td class="border border-gray-300 py-2 px-4">${completed_at_str}</td>
      <td class="border border-gray-300 py-2 px-4">
        <div class="flex gap-2">
          <form action="/delete" method="post" class="delete-form">
            <input type="hidden" name="id" value="${completed.id}">
            <input type="hidden" name="type" value="completed">
            <button type="submit" class="py-1 px-2 bg-red-500 text-white rounded hover:bg-red-600">削除</button>
          </form>
          <form action="/incomplete" method="post" >
            <input type="hidden" name="id" value="${completed.id}">
            <input type="hidden" name="type" value="completed">
            <button type="submit" class="py-1 px-2 bg-green-500 text-white rounded hover:bg-green-600">未完了</button>
          </form>
        </div>
      </td>
    </tr>
  `;
}

// webhookを用いてSlackにメッセージを送信する処理
export function send_slack_message(message) {
  const url = process.env.SLACK_WEBHOOK_URL;
  const data = {
    text: message,
  };
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  };
  fetch(url, options);
}

// 期限が24時間以内のTodoをslackにwebhookで送信して通知する処理
export function notify_todo(TIMEOFFSET, prisma) {
  // 現在時刻からNOTIFY_TIMEに設定された時刻までの待ち時間を計算
  const now = new Date(new Date().getTime() + TIMEOFFSET * 60 * 60 * 1000);
  let wait_time =
    new Date(
      now.toISOString().slice(0, 10) + "T" + process.env.NOTIFY_TIME + ".000Z"
    ) - now;
  if (wait_time < 0) {
    wait_time += 24 * 60 * 60 * 1000;
  }
  setTimeout(async () => {
    const todos = await prisma.todo.findMany({
      where: {
        deadline: {
          lte: new Date(
            new Date().getTime() + (24 + TIMEOFFSET) * 60 * 60 * 1000
          ),
          gte: new Date(new Date().getTime() + TIMEOFFSET * 60 * 60 * 1000),
        },
      },
    });
    for (const todo of todos) {
      let todo_deadline_str = "";
      if (todo.deadline) {
        if (todo.deadline_include_time) {
          todo_deadline_str =
            todo.deadline.toISOString().slice(0, 10) +
            " " +
            todo.deadline.toISOString().slice(11, 16);
        } else {
          todo_deadline_str = todo.deadline.toISOString().slice(0, 10);
        }
      }
      send_slack_message(
        `「${todo.title}」は ${todo_deadline_str} が期限です！`
      );
    }
  }, wait_time);
}
