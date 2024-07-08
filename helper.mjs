import escapeHTML from "escape-html";

export function todo_to_html(todo) {
    let todo_deadline_str = "";
    if (todo.deadline) {
        if (todo.deadline_include_time) {
            todo_deadline_str = todo.deadline.toISOString().slice(0, 10) + " " + todo.deadline.toISOString().slice(11, 16);
        } else {
            todo_deadline_str = todo.deadline.toISOString().slice(0, 10);
        }
    }
    return `
            <tr>
                <td>${escapeHTML(todo.title)}</td>
                <td>${todo_deadline_str}</td>
                <td>
                    <form action="/delete" method="post" class="delete-form">
                        <input type="hidden" name="id" value="${todo.id}">
                        <button type="submit">Delete</button>
                    </form>
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
    let wait_time = new Date(now.toISOString().slice(0, 10) + "T" + process.env.NOTIFY_TIME + ".000Z") - now;
    if (wait_time < 0) {
        wait_time += 24 * 60 * 60 * 1000;
    }
    setTimeout(async () => {
        const todos = await prisma.todo.findMany({
            where: {
                deadline: {
                    lte: new Date(new Date().getTime() + (24 + TIMEOFFSET) * 60 * 60 * 1000),
                    gte: new Date(new Date().getTime() + TIMEOFFSET * 60 * 60 * 1000),
                },
            },
        });
        for (const todo of todos) {
            let todo_deadline_str = "";
            if (todo.deadline) {
                if (todo.deadline_include_time) {
                    todo_deadline_str = todo.deadline.toISOString().slice(0, 10) + " " + todo.deadline.toISOString().slice(11, 16);
                } else {
                    todo_deadline_str = todo.deadline.toISOString().slice(0, 10);
                }
            }
            send_slack_message(`「${todo.title}」は ${todo_deadline_str} が期限です！`);
        }
    }
    , wait_time);
}