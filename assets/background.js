/*
 * Background: contour lines of a cost landscape, with optimizer trajectories
 * (gradient descent with momentum) spiralling into its minima.
 * A new landscape is generated on every page load. Click on an empty spot to
 * start a trajectory there. With prefers-reduced-motion, a still frame is drawn.
 */
(function () {
    "use strict";

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Colors match the site palette (assets/styles.scss, assets/home.css)
    var CONTOUR = "rgba(77, 141, 255, 0.09)";
    var CONTOUR_MAJOR = "rgba(77, 141, 255, 0.16)";
    var TRAIL = "77, 141, 255";
    var MINIMUM = "rgba(151, 161, 178, 0.35)";

    var MAX_TRAJECTORIES = 5;
    var TRAIL_LENGTH = 170;
    var TIME_SCALE = 0.35;   // slows the dynamics down to an ambient pace
    var DAMPING = 1.1;       // low damping gives visible overshoot and spirals

    // ---- landscape: weak quadratic bowl minus a few Gaussian wells ----
    function rand(a, b) { return a + Math.random() * (b - a); }

    var wells = [];
    var nWells = 4 + Math.floor(Math.random() * 3);
    for (var i = 0; i < nWells; i++) {
        wells.push({ x: rand(-0.95, 0.95), y: rand(-0.3, 0.45), a: rand(0.45, 1.1), s: rand(0.11, 0.26) });
    }
    // one or two gentle ridges for more interesting level sets
    for (var j = 0; j < 2; j++) {
        wells.push({ x: rand(-0.8, 0.8), y: rand(-0.2, 0.4), a: -rand(0.2, 0.45), s: rand(0.15, 0.3) });
    }
    var BOWL = 0.35;

    function cost(x, y) {
        var f = BOWL * (x * x + y * y);
        for (var k = 0; k < wells.length; k++) {
            var w = wells[k], dx = x - w.x, dy = y - w.y;
            f -= w.a * Math.exp(-(dx * dx + dy * dy) / (2 * w.s * w.s));
        }
        return f;
    }

    function gradient(x, y) {
        var gx = 2 * BOWL * x, gy = 2 * BOWL * y;
        for (var k = 0; k < wells.length; k++) {
            var w = wells[k], dx = x - w.x, dy = y - w.y, s2 = w.s * w.s;
            var e = w.a * Math.exp(-(dx * dx + dy * dy) / (2 * s2)) / s2;
            gx += e * dx;
            gy += e * dy;
        }
        return [gx, gy];
    }

    // ---- canvases ----
    var root = document.createElement("div");
    root.className = "bg-field";
    root.setAttribute("aria-hidden", "true");
    var contourCanvas = document.createElement("canvas");
    var trailCanvas = document.createElement("canvas");
    root.appendChild(contourCanvas);
    root.appendChild(trailCanvas);
    document.body.insertBefore(root, document.body.firstChild);

    var cctx = contourCanvas.getContext("2d");
    var tctx = trailCanvas.getContext("2d");
    var W = 0, H = 0, S = 1, dpr = 1;

    // screen <-> landscape coordinates (landscape origin a bit above the middle)
    function toScreen(x, y) { return [W / 2 + x * S, H * 0.4 + y * S]; }
    function toLandscape(px, py) { return [(px - W / 2) / S, (py - H * 0.4) / S]; }

    function sizeCanvas(c, ctx) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ---- contours (marching squares), drawn once per resize ----
    var CASES = {
        1: [["l", "b"]], 2: [["b", "r"]], 3: [["l", "r"]], 4: [["t", "r"]],
        5: [["l", "t"], ["b", "r"]], 6: [["t", "b"]], 7: [["l", "t"]], 8: [["l", "t"]],
        9: [["t", "b"]], 10: [["t", "r"], ["l", "b"]], 11: [["t", "r"]], 12: [["l", "r"]],
        13: [["b", "r"]], 14: [["l", "b"]]
    };

    function drawContours() {
        var g = 8;
        var nx = Math.ceil(W / g) + 1, ny = Math.ceil(H / g) + 1;
        var V = new Float32Array(nx * ny);
        var lo = Infinity, hi = -Infinity;
        for (var yy = 0; yy < ny; yy++) {
            for (var xx = 0; xx < nx; xx++) {
                var p = toLandscape(xx * g, yy * g), v = cost(p[0], p[1]);
                V[yy * nx + xx] = v;
                if (v < lo) lo = v;
                if (v > hi) hi = v;
            }
        }
        var step = (hi - lo) / 28;
        var minor = new Path2D(), major = new Path2D();
        for (yy = 0; yy < ny - 1; yy++) {
            for (xx = 0; xx < nx - 1; xx++) {
                var a = V[yy * nx + xx], b = V[yy * nx + xx + 1];
                var c = V[(yy + 1) * nx + xx + 1], d = V[(yy + 1) * nx + xx];
                var cmin = Math.min(a, b, c, d), cmax = Math.max(a, b, c, d);
                var first = Math.ceil((cmin - lo) / step), last = Math.floor((cmax - lo) / step);
                for (var n = first; n <= last; n++) {
                    var L = lo + n * step;
                    var idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
                    var segs = CASES[idx];
                    if (!segs) continue;
                    var E = {
                        t: [(xx + (L - a) / (b - a)) * g, yy * g],
                        r: [(xx + 1) * g, (yy + (L - b) / (c - b)) * g],
                        b: [(xx + (L - d) / (c - d)) * g, (yy + 1) * g],
                        l: [xx * g, (yy + (L - a) / (d - a)) * g]
                    };
                    var path = n % 4 === 0 ? major : minor;
                    for (var s = 0; s < segs.length; s++) {
                        path.moveTo(E[segs[s][0]][0], E[segs[s][0]][1]);
                        path.lineTo(E[segs[s][1]][0], E[segs[s][1]][1]);
                    }
                }
            }
        }
        cctx.clearRect(0, 0, W, H);
        cctx.lineWidth = 1;
        cctx.strokeStyle = CONTOUR;
        cctx.stroke(minor);
        cctx.strokeStyle = CONTOUR_MAJOR;
        cctx.stroke(major);

        // mark the local minima with a small cross, as on a contour plot
        cctx.strokeStyle = MINIMUM;
        cctx.lineWidth = 1;
        var seen = [];
        for (var k = 0; k < wells.length; k++) {
            if (wells[k].a < 0) continue;
            var m = [wells[k].x, wells[k].y];
            for (var it = 0; it < 400; it++) {
                var gr = gradient(m[0], m[1]);
                m[0] -= 0.004 * gr[0];
                m[1] -= 0.004 * gr[1];
            }
            var sp = toScreen(m[0], m[1]);
            var dup = seen.some(function (q) { return Math.hypot(q[0] - sp[0], q[1] - sp[1]) < 12; });
            if (dup) continue;
            seen.push(sp);
            cctx.beginPath();
            cctx.moveTo(sp[0] - 4, sp[1] - 4); cctx.lineTo(sp[0] + 4, sp[1] + 4);
            cctx.moveTo(sp[0] + 4, sp[1] - 4); cctx.lineTo(sp[0] - 4, sp[1] + 4);
            cctx.stroke();
        }
    }

    // ---- trajectories ----
    var trajectories = [];

    function spawn(x, y) {
        if (x === undefined) {
            // start somewhere on the upper part of the screen, where the background is visible
            var p = toLandscape(rand(0.05, 0.95) * W, rand(0.03, 0.6) * H);
            x = p[0]; y = p[1];
        }
        trajectories.push({ x: x, y: y, vx: 0, vy: 0, trail: [], age: 0, still: 0, fade: 1, dying: false });
    }

    function stepTrajectory(tr, dt) {
        var g = gradient(tr.x, tr.y);
        tr.vx += (-g[0] - DAMPING * tr.vx) * dt;
        tr.vy += (-g[1] - DAMPING * tr.vy) * dt;
        tr.x += tr.vx * dt;
        tr.y += tr.vy * dt;
        tr.age += dt;
        var speed = Math.hypot(tr.vx, tr.vy);
        tr.still = speed < 0.01 ? tr.still + dt : 0;
        if (!tr.dying && (tr.still > 1.2 || tr.age > 30)) tr.dying = true;
        if (tr.dying) tr.fade -= dt * 0.35;
        tr.trail.push(toScreen(tr.x, tr.y));
        if (tr.trail.length > TRAIL_LENGTH) tr.trail.shift();
    }

    function drawTrajectory(tr) {
        var pts = tr.trail, n = pts.length;
        if (n < 2) return;
        var chunks = 10;
        tctx.lineWidth = 1.4;
        tctx.lineJoin = "round";
        tctx.lineCap = "round";
        for (var c = 0; c < chunks; c++) {
            var i0 = Math.floor(c * (n - 1) / chunks), i1 = Math.floor((c + 1) * (n - 1) / chunks);
            if (i1 <= i0) continue;
            var alpha = 0.55 * ((c + 1) / chunks) * Math.max(0, tr.fade);
            tctx.strokeStyle = "rgba(" + TRAIL + "," + alpha.toFixed(3) + ")";
            tctx.beginPath();
            tctx.moveTo(pts[i0][0], pts[i0][1]);
            for (var i = i0 + 1; i <= i1; i++) tctx.lineTo(pts[i][0], pts[i][1]);
            tctx.stroke();
        }
        var head = pts[n - 1];
        tctx.fillStyle = "rgba(" + TRAIL + "," + (0.9 * Math.max(0, tr.fade)).toFixed(3) + ")";
        tctx.beginPath();
        tctx.arc(head[0], head[1], 2.2, 0, Math.PI * 2);
        tctx.fill();
    }

    var lastTime = null, nextSpawn = 0;

    function frame(ms) {
        var t = ms / 1000;
        var dt = lastTime === null ? 0 : Math.min(0.05, t - lastTime);
        lastTime = t;

        if (t > nextSpawn && trajectories.length < MAX_TRAJECTORIES) {
            spawn();
            nextSpawn = t + rand(1.5, 4);
        }

        tctx.clearRect(0, 0, W, H);
        var sdt = dt * TIME_SCALE;
        for (var i = trajectories.length - 1; i >= 0; i--) {
            var tr = trajectories[i];
            // two sub-steps per frame keep the integration smooth in steep wells
            stepTrajectory(tr, sdt / 2);
            stepTrajectory(tr, sdt / 2);
            if (tr.fade <= 0) { trajectories.splice(i, 1); continue; }
            drawTrajectory(tr);
        }
        requestAnimationFrame(frame);
    }

    function stillFrame() {
        tctx.clearRect(0, 0, W, H);
        trajectories = [];
        for (var k = 0; k < 4; k++) {
            spawn();
            var tr = trajectories[k];
            for (var s = 0; s < 600 && tr.still < 0.5; s++) stepTrajectory(tr, 1 / 60 * TIME_SCALE * 2);
            tr.fade = 1;
            drawTrajectory(tr);
        }
    }

    function layout() {
        W = window.innerWidth;
        H = window.innerHeight;
        S = Math.max(W, H) / 2;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        sizeCanvas(contourCanvas, cctx);
        sizeCanvas(trailCanvas, tctx);
        drawContours();
        trajectories = [];
        if (reduceMotion) stillFrame();
    }

    // Rebuild on real resizes only: mobile browsers change the height while scrolling
    var resizeTimer = null, lastW = 0, lastH = 0;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 120) return;
            lastW = window.innerWidth;
            lastH = window.innerHeight;
            layout();
        }, 150);
    });

    // Click on an empty spot to release a trajectory there
    if (!reduceMotion) {
        document.addEventListener("pointerdown", function (e) {
            if (e.button !== 0) return;
            if (e.target.closest("a, button, video, input, textarea, select, label, [role='button'], .showcase")) return;
            var p = toLandscape(e.clientX, e.clientY);
            if (trajectories.length >= MAX_TRAJECTORIES + 3) trajectories.shift();
            spawn(p[0], p[1]);
        });
    }

    lastW = window.innerWidth;
    lastH = window.innerHeight;
    layout();
    if (!reduceMotion) requestAnimationFrame(frame);
})();
