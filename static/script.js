const deleteForms = document.querySelectorAll(".delete-form");

for (const deleteForm of deleteForms) {
  deleteForm.onsubmit = (e) => {
    if (!window.confirm("本当に削除しますか？")) {
      e.preventDefault();
    }
  };
}

const completedForms = document.querySelectorAll(".completed-form");
for (const completedForm of completedForms) {
  completedForm.onsubmit = (e) => {
    if (!window.confirm("本当に完了状態にしますか？")) {
      e.preventDefault();
    }
  };
}

// table-sortクラスのa要素をクリックしたときの処理
const tableSorts = document.querySelectorAll(".table-sort a");
const saveParams = [
  "sortkey",
  "sortorder",
  "sortkey_completed",
  "sortorder_completed",
];

for (const tableSort of tableSorts) {
  tableSort.onclick = () => {
    let [sort_key, sort_order, sort_object] = tableSort.id.split("_");

    let baseUrl = new URL(window.location.origin + window.location.pathname);
    for (const [key, value] of window.location.search) {
      if (saveParams.includes(key)) {
        baseUrl.searchParams.set(key, value);
      }
    }

    if (sort_object == "todo") {
      baseUrl.searchParams.set("sortkey", sort_key);
      baseUrl.searchParams.set("sortorder", sort_order);
    } else if (sort_object == "completed") {
      baseUrl.searchParams.set("sortkey_completed", sort_key);
      baseUrl.searchParams.set("sortorder_completed", sort_order);
    }
    window.location.href = baseUrl.href;
  };
}

// バリデーション処理
const format_text_255 = /^.{0,255}$/; // 255文字以下
const format_date_YYMMDD = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
const format_time_HHMM = /^\d{2}:\d{2}$/; // HH:MM
function validate_form(form) {
  const inputs = form.querySelectorAll("input");
  for (const input of inputs) {
    const classList = input.classList;
    if (classList.contains("form-allow-empty")) {
      if (input.value == "") {
        continue;
      }
    } else if (input.value == "") {
      const label = form.querySelector(`label[for=${input.id}]`);
      alert(`${label.textContent}は入力必須です`);
      return false;
    }
    if (
      classList.contains("form-text-255") &&
      !format_text_255.test(input.value)
    ) {
      alert("文字数は255文字以下で入力してください");
      return false;
    } else if (
      classList.contains("form-date-YYMMDD") &&
      !format_date_YYMMDD.test(input.value)
    ) {
      alert("日付はYYYY-MM-DDの形式で入力してください");
      return false;
    } else if (
      classList.contains("form-time-HHMM") &&
      !format_time_HHMM.test(input.value)
    ) {
      alert("時刻はHH:MMの形式で入力してください");
      return false;
    }
  }
}

// ページを読み込んだときに実行
window.onload = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const message = urlParams.get("message");
  const message_dict = {
    error: "エラーが発生しました",
    created: "作成しました",
    updated: "更新しました",
    deleted: "削除しました",
  };
  if (message) {
    if (message in message_dict) {
      alert(message_dict[message]);
    } else {
      alert(message);
    }
    window.location.href = "/";
  }
};
document.querySelectorAll(".edit-button").forEach((button) => {
  button.addEventListener("click", function () {
    const row = this.closest("tr");
    const deadlineCell = row.children[1];
    const updateForm = row.querySelector(".update-form");

    const deadlineText = deadlineCell.textContent.trim();
    let [date, time] = deadlineText.split(" ");

    deadlineCell.innerHTML = `
        <input type="date" name="todo_deadline_date" value="${
          date || ""
        }" class="py-1 px-2 border border-gray-300 rounded">
        <input type="time" name="todo_deadline_time" value="${
          time || ""
        }" class="py-1 px-2 border border-gray-300 rounded">
      `;

    this.textContent = "保存";
    this.classList.remove("bg-yellow-500", "hover:bg-yellow-600");
    this.classList.add("bg-green-500", "hover:bg-green-600");
    this.classList.add("save-button");

    button.removeEventListener("click", arguments.callee);

    this.addEventListener("click", function () {
      const newDate = deadlineCell.querySelector(
        'input[name="todo_deadline_date"]'
      ).value;
      const newTime = deadlineCell.querySelector(
        'input[name="todo_deadline_time"]'
      ).value;

      updateForm.querySelector('input[name="todo_deadline_date"]').value =
        newDate;
      updateForm.querySelector('input[name="todo_deadline_time"]').value =
        newTime;

      if (updateForm.onsubmit() === false) {
        return;
      }

      fetch(updateForm.action, {
        method: "PUT",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(new FormData(updateForm)),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("更新に失敗しました");
          }
          return response.text();
        })
        .then(() => {
          window.confirm("更新に成功しました");
          window.location.reload();
        })
        .catch((error) => {
          window.alert("エラーが発生しました", error.message);
          alert(error.message);
          window.location.reload();
        });
    });
  });
});
