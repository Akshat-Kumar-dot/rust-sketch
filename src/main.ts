
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
const ctx = canvas.getContext("2d")!;
const workspace = document.querySelector<HTMLElement>("#workspace")!;

const penBtn = document.querySelector<HTMLButtonElement>("#penBtn")!;
const eraserBtn = document.querySelector<HTMLButtonElement>("#eraserBtn")!;
const colorPicker = document.querySelector<HTMLInputElement>("#colorPicker")!;
const sizePicker = document.querySelector<HTMLInputElement>("#sizePicker")!;
const clearBtn = document.querySelector<HTMLButtonElement>("#clearBtn")!;
const zoomLabel = document.querySelector<HTMLElement>("#zoomLabel")!;

type Point = { x: number; y: number };

type Stroke = {
    color: string;
    size: number;
    points: Point[];
};

let strokes: Stroke[] = [];
let currentStroke: Stroke | null = null;

let drawing = false;
let panning = false;
let spacePressed = false;
let tool: "pen" | "eraser" = "pen";

let color = colorPicker.value;
let size = Number(sizePicker.value);

let zoom = 1;
let offsetX = 0;
let offsetY = 0;

let panStartX = 0;
let panStartY = 0;

function resizeCanvas(): void {
    const rect = workspace.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    render();
}

function screenToWorld(x: number, y: number): Point {
    return {
        x: (x - offsetX) / zoom,
        y: (y - offsetY) / zoom
    };
}

function getPointerPosition(
    event: Pick<PointerEvent, "clientX" | "clientY">
): Point {
    const rect = canvas.getBoundingClientRect();

    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function drawStroke(stroke: Stroke): void {
    if (stroke.points.length === 0) return;

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }

    if (stroke.points.length === 1) {
        ctx.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y);
    }

    ctx.stroke();
}

function render(): void {
    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(
        dpr * zoom, 0,
        0, dpr * zoom,
        dpr * offsetX, dpr * offsetY
    );

    for (const stroke of strokes) {
        drawStroke(stroke);
    }

    if (currentStroke) {
        drawStroke(currentStroke);
    }
}

canvas.addEventListener("pointerdown", (event: PointerEvent) => {
    canvas.setPointerCapture(event.pointerId);

    const pos = getPointerPosition(event);

    if (spacePressed || event.button === 1) {
        panning = true;
        panStartX = pos.x - offsetX;
        panStartY = pos.y - offsetY;
        canvas.style.cursor = "grabbing";
        return;
    }

    if (event.button !== 0) return;

    drawing = true;

    const point = screenToWorld(pos.x, pos.y);

    currentStroke = {
        color: tool === "eraser" ? "#fafaf8" : color,
        size: tool === "eraser" ? size * 4 : size,
        points: [point]
    };

    render();
});

canvas.addEventListener("pointermove", (event: PointerEvent) => {
    const pos = getPointerPosition(event);

    if (panning) {
        offsetX = pos.x - panStartX;
        offsetY = pos.y - panStartY;
        render();
        return;
    }

    if (!drawing || !currentStroke) return;

    currentStroke.points.push(screenToWorld(pos.x, pos.y));
    render();
});

function stopInteraction(): void {
    if (drawing && currentStroke) {
        strokes.push(currentStroke);
    }

    drawing = false;
    panning = false;
    currentStroke = null;

    canvas.style.cursor = spacePressed ? "grab" : "crosshair";
    render();
}

canvas.addEventListener("pointerup", stopInteraction);
canvas.addEventListener("pointercancel", stopInteraction);

canvas.addEventListener("wheel", (event: WheelEvent) => {
    event.preventDefault();

    const pos = getPointerPosition(event);
    const worldBeforeZoom = screenToWorld(pos.x, pos.y);

    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoom = Math.min(5, Math.max(0.2, zoom * factor));

    offsetX = pos.x - worldBeforeZoom.x * zoom;
    offsetY = pos.y - worldBeforeZoom.y * zoom;

    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    render();
}, { passive: false });

window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.code === "Space" && !event.repeat) {
        spacePressed = true;
        canvas.style.cursor = "grab";
        event.preventDefault();
    }
});

window.addEventListener("keyup", (event: KeyboardEvent) => {
    if (event.code === "Space") {
        spacePressed = false;
        canvas.style.cursor = "crosshair";
    }
});

penBtn.addEventListener("click", () => {
    tool = "pen";
    penBtn.classList.add("active");
    eraserBtn.classList.remove("active");
});

eraserBtn.addEventListener("click", () => {
    tool = "eraser";
    eraserBtn.classList.add("active");
    penBtn.classList.remove("active");
});

colorPicker.addEventListener("input", () => {
    color = colorPicker.value;
});

sizePicker.addEventListener("input", () => {
    size = Number(sizePicker.value);
});

clearBtn.addEventListener("click", () => {
    strokes = [];
    currentStroke = null;
    render();
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
