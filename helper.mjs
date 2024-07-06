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