import fs from "node:fs";
import express from "express";
import { PrismaClient } from "@prisma/client";

import { todo_to_html } from "./helper.mjs";

const TIMEOFFSET = 9;
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static("static"));
const prisma = new PrismaClient();

const template = fs.readFileSync("./template.html", "utf-8");
app.get("/", async (request, response) => {
  const todos = await prisma.todo.findMany();
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
      todo_deadline = new Date();
      todo_deadline.setHours(todo_deadline.getHours() + TIMEOFFSET - 24);
      console.log(todo_deadline.toISOString().slice(11, 16));
      console.log(request.body.todo_deadline_time);
      if (request.body.todo_deadline_time < todo_deadline.toISOString().slice(11, 16)) {
        // 設定時刻が現在時刻よりも前の場合は翌日に設定
        todo_deadline.setDate(todo_deadline.getDate() + 1);
      }
      todo_deadline.setHours(parseInt(request.body.todo_deadline_time.slice(0, 2)) + TIMEOFFSET);
      todo_deadline.setMinutes(parseInt(request.body.todo_deadline_time.slice(3, 5)));
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
  response.redirect("/");
});

app.post("/delete", async (request, response) => {
  await prisma.todo.delete({
    where: { id: parseInt(request.body.id) },
  });
  response.redirect("/");
});

app.listen(3000);
