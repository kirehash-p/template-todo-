import fs from "node:fs";
import express from "express";
import { PrismaClient } from "@prisma/client";

import { todo_to_html, notify_todo } from "./helper.mjs";

const TIMEOFFSET = 9;
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static("static"));
const prisma = new PrismaClient();

const sortable_keys = ["id", "title", "deadline"]; // schema.prismaのTodoモデル内の列のうち、ソートを許可する列
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
  const html = template.replace(
    "<!-- todos -->",
    todos
      .map(
        (todo) => todo_to_html(todo),
      )
      .join(""),
  );
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
        todo_deadline = new Date(request.body.todo_deadline_date + "T" + request.body.todo_deadline_time);
        todo_deadline.setHours(todo_deadline.getHours() + TIMEOFFSET);
        todo_deadline_include_time = true;
      }
    } else {
      if (request.body.todo_deadline_time != "") {
        // 期限の日付が設定されていないが時刻のみ設定されている場合
        let now = new Date();
        const [hours, minutes] = request.body.todo_deadline_time.split(":").map(Number);
        todo_deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
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
      }
    });
    response.redirect("/?message=created");
  } catch (error) {
    response.redirect("/?message=error");
  }
});

app.post("/delete", async (request, response) => {
  try {
    await prisma.todo.delete({
      where: { id: parseInt(request.body.id) },
    });
    response.redirect("/");
  } catch (error) {
    response.redirect("/?message=error");
  }
});

// その日が期限のTodoのリマインドを1日に一回実行する
notify_todo(TIMEOFFSET, prisma);
setInterval(async () => {
  notify_todo(TIMEOFFSET, prisma);
}, 24 * 60 * 60 * 1000);

app.listen(3000);
