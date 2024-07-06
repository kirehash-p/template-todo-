const deleteForms = document.querySelectorAll(".delete-form");

for (const deleteForm of deleteForms) {
  deleteForm.onsubmit = (e) => {
    if (!window.confirm("本当に削除しますか？")) {
      e.preventDefault();
    }
  };
}

// table-sortクラスのa要素をクリックしたときの処理
const tableSorts = document.querySelectorAll(".table-sort a");
for (const tableSort of tableSorts) {
  tableSort.onclick = () => {
    let [sort_key, sort_order] = tableSort.id.split("_");
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("sortkey", sort_key);
    currentUrl.searchParams.set("sortorder", sort_order);
    window.location.href = currentUrl.href;
  };
}