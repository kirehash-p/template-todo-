import fs from "node:fs";
import express from "express";
import { PrismaClient } from "@prisma/client";

import { todo_to_html, completed_to_html, notify_todo } from "./helper.mjs";

const TIMEOFFSET = 9;
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static("static"));
const prisma = new PrismaClient();

const sortable_keys = ["id", "title", "deadline"]; // schema.prismaのTodoモデル内の列のうち、ソートを許可する列
const sortable_keys_completed = ["id", "title", "completedAt"];
const template = fs.readFileSync("./template.html", "utf-8");
app.get("/", async (request, response) => {
  let sort_key = request.query.sortkey;
  if (!sortable_keys.includes(sort_key)) {
    sort_key = "deadline";
  }
  let sort_order = request.query.sortorder;
  if (sort_order != "asc" && sort_order != "desc") {
    sort_order = "asc";
  }
  const todos = await prisma.todo.findMany({
    orderBy: {
      [sort_key]: sort_order,
    },
  });

  let sort_key_completed = request.query.sortkey_completed;
  if (!sortable_keys_completed.includes(sort_key_completed)) {
    sort_key_completed = "completedAt";
  }
  let sort_order_completed = request.query.sortorder_completed;
  if (sort_order_completed != "asc" && sort_order_completed != "desc") {
    sort_order_completed = "asc";
  }
  const completeds = await prisma.completed.findMany({
    orderBy: {
      [sort_key_completed]: sort_order_completed,
    },
  });

  const html = template
    .replace("<!-- todos -->", todos.map((todo) => todo_to_html(todo)).join(""))
    .replace(
      "<!-- completeds -->",
      completeds.map((completed) => completed_to_html(completed)).join("")
    );
  response.send(html);
});

//編集
app.get("/edit", async (request, response) => {
  const todo = await prisma.todo.findUnique({
    where: { id: parseInt(request.query.id) },
  });

  const todo_deadline_str = todo.deadline
    ? todo.deadline.toISOString().slice(0, 10)
    : "";
  const todo_deadline_time_str = todo.deadline
    ? todo.deadline.toISOString().slice(11, 16)
    : "";

  const html = `
    <!doctype html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>ToDoリスト</title>
      <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100 min-h-screen flex flex-col items-center justify-center">
      <div class="container mx-auto p-4 w-full md:w-2/3">
        <form id="todo_edit_form" action="/update" method="post" onsubmit="return validate_form(this)" class="bg-white p-4 rounded shadow">
          <input type="hidden" name="id" value="${todo.id}">
          <div class="flex items-center mb-2">
            <label for="todo_title" class="mr-2">タイトル</label>
            <input type="text" name="todo_title" id="todo_title" value="${escapeHTML(
              todo.title
            )}" class="form-text-255 py-1 px-2 border border-gray-300 rounded flex-grow">
          </div>
          <div class="flex items-center mb-2">
            <label for="todo_deadline_date" class="form-text-255 mr-2">期限(日にち)</label>
            <input type="date" name="todo_deadline_date" id="todo_deadline_date" value="${todo_deadline_str}" class="form-date-YYMMDD form-allow-empty py-1 px-2 border border-gray-300 rounded">
          </div>
          <div class="flex items-center mb-2">
            <label for="todo_deadline_time" class="mr-2">期限(時刻)</label>
            <input type="time" name="todo_deadline_time" id="todo_deadline_time" value="${todo_deadline_time_str}" class="form-time-HHMM form-allow-empty py-1 px-2 border border-gray-300 rounded">
          </div>
          <div class="flex justify-end">
            <button type="submit" class="py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600">更新</button>
          </div>
        </form>
      </div>
    </body>
    </html>
  `;
  response.send(html);
});

app.post("/create", async (request, response) => {
  try {
    let todo_deadline;
    let todo_deadline_include_time = false;
    if (request.body.todo_deadline_date != "") {
      if (request.body.todo_deadline_time == "") {
        // 期限の日付のみ設定されている場合
        todo_deadline = new Date(request.body.todo_deadline_date);
        todo_deadline.setHours(todo_deadline.getHours() + TIMEOFFSET);
        todo_deadline_include_time = false;
      } else {
        // 期限の日付と時刻が設定されている場合
        todo_deadline = new Date(
          request.body.todo_deadline_date +
            "T" +
            request.body.todo_deadline_time
        );
        todo_deadline.setHours(todo_deadline.getHours() + TIMEOFFSET);
        todo_deadline_include_time = true;
      }
    } else {
      if (request.body.todo_deadline_time != "") {
        // 期限の日付が設定されていないが時刻のみ設定されている場合
        let now = new Date();
        const [hours, minutes] = request.body.todo_deadline_time
          .split(":")
          .map(Number);
        todo_deadline = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hours,
          minutes,
          0,
          0
        );
        if (now > todo_deadline) {
          todo_deadline.setDate(todo_deadline.getDate() + 1);
        }
        todo_deadline.setHours(todo_deadline.getHours() + TIMEOFFSET);
        todo_deadline_include_time = true;
      } else {
        // 期限が設定されていない場合
        todo_deadline = null;
        todo_deadline_include_time = false;
      }
    }
    await prisma.todo.create({
      data: {
        title: request.body.todo_title,
        deadline: todo_deadline,
        deadline_include_time: todo_deadline_include_time,
      },
    });
    response.redirect("/?message=created");
  } catch (error) {
    response.redirect("/?message=error");
  }
});

app.post("/delete", async (request, response) => {
  try {
    if (request.body.type == "todo") {
      await prisma.todo.delete({
        where: { id: parseInt(request.body.id) },
      });
    } else if (request.body.type == "completed") {
      await prisma.completed.delete({
        where: { id: parseInt(request.body.id) },
      });
    }
    response.redirect("/");
  } catch (error) {
    response.redirect("/?message=error");
  }
});

//todoを完了済みに
app.post("/completed", async (request, response) => {
  try {
    const todo = await prisma.todo.findUnique({
      where: { id: parseInt(request.body.id) },
    });
    const now = new Date();
    now.setHours(now.getHours() + TIMEOFFSET);
    await prisma.completed.create({
      data: {
        title: todo.title,
        deadline: todo.deadline,
        deadline_include_time: todo.deadline_include_time,
        completedAt: now,
        createdAt: todo.createdAt,
        updatedAt: now,
      },
    });
    await prisma.todo.delete({
      where: { id: parseInt(request.body.id) },
    });

    response.redirect("/");
  } catch (error) {
    response.redirect("/?message=error");
  }
});

// 完了済みタスクを未完了に戻す
app.post("/incomplete", async (request, response) => {
  try {
    const completed = await prisma.completed.findUnique({
      where: { id: parseInt(request.body.id) },
    });

    await prisma.todo.create({
      data: {
        title: completed.title,
        deadline: completed.deadline,
        deadline_include_time: completed.deadline_include_time,
      },
    });

    await prisma.completed.delete({
      where: { id: parseInt(request.body.id) },
    });

    response.redirect("/");
  } catch (error) {
    response.redirect("/?message=error");
  }
});

//追加済みタスクの期限を変更する
app.put("/update", async (request, response) => {
  try {
    let todo_deadline;
    let todo_deadline_include_time = false;

    if (request.body.todo_deadline_date != "") {
      if (request.body.todo_deadline_time == "") {
        todo_deadline = new Date(request.body.todo_deadline_date);
        todo_deadline.setHours(todo_deadline.getHours() + TIMEOFFSET);
        todo_deadline_include_time = false;
      } else {
        todo_deadline = new Date(
          request.body.todo_deadline_date +
            "T" +
            request.body.todo_deadline_time
        );
        todo_deadline.setHours(todo_deadline.getHours() + TIMEOFFSET);
        todo_deadline_include_time = true;
      }
    } else {
      if (request.body.todo_deadline_time != "") {
        let now = new Date();
        const [hours, minutes] = request.body.todo_deadline_time
          .split(":")
          .map(Number);
        todo_deadline = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hours,
          minutes,
          0,
          0
        );
        if (now > todo_deadline) {
          todo_deadline.setDate(todo_deadline.getDate() + 1);
        }
        todo_deadline.setHours(todo_deadline.getHours() + TIMEOFFSET);
        todo_deadline_include_time = true;
      } else {
        todo_deadline = null;
        todo_deadline_include_time = false;
      }
    }

    await prisma.todo.update({
      where: { id: parseInt(request.body.id) },
      data: {
        title: request.body.todo_title,
        deadline: todo_deadline,
        deadline_include_time: todo_deadline_include_time,
      },
    });

    response.status(200).send("OK");
  } catch (error) {
    response.status(500).send("Error");
  }
});

// その日が期限のTodoのリマインドを1日に一回実行する
notify_todo(TIMEOFFSET, prisma);
setInterval(async () => {
  notify_todo(TIMEOFFSET, prisma);
}, 24 * 60 * 60 * 1000);

app.listen(3000);
