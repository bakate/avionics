import { Todo } from "@workspace/domain/todos";
import { Schema } from "effect";

import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div>
    <h1>Domain Object Test</h1>
    <div class="card">
        <p id="todo-display">Loading...</p>
    </div>
  </div>
`;

// Example Usage
const exampleTodo = {
	id: 1,
	title: "Learn Effect Schema",
	completed: false,
	createdAt: new Date().toISOString(),
	updatedAt: null,
};

// Decode using the shared Schema
const decoded = Schema.decodeUnknownSync(Todo)(exampleTodo);

// Display it
const displayOpts = {
	...decoded,
	createdAt: decoded.createdAt.toLocaleString(),
};

document.querySelector("#todo-display")!.innerHTML = `
  <pre>${JSON.stringify(displayOpts, null, 2)}</pre>
`;

console.log("Decoded Todo:", decoded);
