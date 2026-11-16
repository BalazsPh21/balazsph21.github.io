// Landing page: horizontally rotating carousel of project media.
// Every slide, photo or video, stays for DWELL ms. Videos play muted and loop, and each
// visit resumes where the last one stopped, so the whole clip is seen over a few rotations.
// Swiping or scrolling the track works without this script; this adds autoplay and controls.
(function () {
    'use strict';

    var DWELL = 6000;

    var root = document.querySelector('.showcase');
    if (!root) return;

    var track = root.querySelector('.showcase-track');
    var slides = Array.prototype.slice.call(track.querySelectorAll('.slide'));
    var controls = root.querySelector('.showcase-controls');
    var dotsBox = root.querySelector('.showcase-dots');
    var toggleBtn = controls.querySelector('[data-action="toggle"]');
    var n = slides.length;
    if (!n) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var current = 0;
    var playing = !reduceMotion; // reduced motion: start paused, nothing moves until the visitor presses play
    var held = false;            // mouse over the carousel or keyboard focus inside it
    var visible = true;          // on screen and the tab is in the foreground
    var timer = null;
    var dots = [];

    function videoOf(i) {
        return slides[i].querySelector('video');
    }

    // ---- Setup ----

    slides.forEach(function (slide, i) {
        slide.setAttribute('aria-label', (i + 1) + ' of ' + n);
        var v = videoOf(i);
        if (!v) return;
        v.muted = true; // required for autoplay
        v.loop = true;
        // Start the slot over once playback really begins, so a slow-loading video still gets its full time
        v.addEventListener('playing', function () {
            if (i === current) schedule();
        });
    });

    if (n > 1) {
        slides.forEach(function (slide, i) {
            var dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'showcase-dot';
            dot.setAttribute('aria-label', 'Show slide ' + (i + 1));
            dot.addEventListener('click', function () { goTo(i); });
            dotsBox.appendChild(dot);
            dots.push(dot);
        });
        controls.hidden = false;
    }

    // ---- Rotation ----

    function schedule() {
        clearTimeout(timer);
        if (!playing || held || !visible || n < 2) return;
        timer = setTimeout(next, DWELL);
    }

    function playCurrent() {
        slides.forEach(function (slide, i) {
            var v = videoOf(i);
            if (v && i !== current && !v.paused) v.pause();
        });
        schedule();
        var v = videoOf(current);
        if (!v || !playing || !visible) return;
        var p = v.play();
        // Autoplay can be refused (e.g. power saving); the poster or paused frame then shows for the slot
        if (p && p.catch) p.catch(function () {});
    }

    function activate(i) {
        current = i;
        dots.forEach(function (dot, j) {
            dot.setAttribute('aria-current', j === i ? 'true' : 'false');
        });
        playCurrent();
    }

    function goTo(i) {
        i = (i + n) % n;
        track.scrollTo({ left: i * track.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
        if (i !== current) activate(i);
    }

    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }

    function showPlayState() {
        toggleBtn.setAttribute('aria-label', playing ? 'Pause slideshow' : 'Play slideshow');
        toggleBtn.querySelector('i').className = playing ? 'fas fa-pause' : 'fas fa-play';
        track.setAttribute('aria-live', playing ? 'off' : 'polite');
    }

    function setPlaying(on) {
        playing = on;
        showPlayState();
        if (on) {
            playCurrent();
        } else {
            clearTimeout(timer);
            var v = videoOf(current);
            if (v) v.pause();
        }
    }

    // ---- Controls ----

    controls.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-action');
        if (action === 'next') next();
        else if (action === 'prev') prev();
        else if (action === 'toggle') setPlaying(!playing);
    });

    // Hold the rotation while the mouse is over it or a keyboard user is inside it
    root.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse') return;
        held = true;
        clearTimeout(timer);
    });
    root.addEventListener('pointerleave', function (e) {
        if (e.pointerType !== 'mouse') return;
        held = false;
        schedule();
    });
    root.addEventListener('focusin', function (e) {
        if (!e.target.matches(':focus-visible')) return;
        held = true;
        clearTimeout(timer);
    });
    root.addEventListener('focusout', function (e) {
        if (root.contains(e.relatedTarget)) return;
        held = false;
        schedule();
    });

    // Follow swipes and keyboard scrolling of the track once it settles on a slide
    function onSettle() {
        var i = Math.round(track.scrollLeft / track.clientWidth);
        if (i >= 0 && i < n && i !== current) activate(i);
    }
    if ('onscrollend' in window) {
        track.addEventListener('scrollend', onSettle);
    } else {
        var settleTimer;
        track.addEventListener('scroll', function () {
            clearTimeout(settleTimer);
            settleTimer = setTimeout(onSettle, 150);
        }, { passive: true });
    }

    // Keep the current slide aligned when the layout width changes
    window.addEventListener('resize', function () {
        track.scrollTo({ left: current * track.clientWidth, behavior: 'auto' });
    });

    // Don't play or rotate while off screen or in a background tab
    var onScreen = true;
    function updateVisible() {
        var now = onScreen && !document.hidden;
        if (now === visible) return;
        visible = now;
        if (visible) {
            playCurrent();
        } else {
            clearTimeout(timer);
            var v = videoOf(current);
            if (v) v.pause();
        }
    }
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            onScreen = entries[0].isIntersecting;
            updateVisible();
        }, { threshold: 0.25 }).observe(root);
    }
    document.addEventListener('visibilitychange', updateVisible);

    // ---- Start ----

    showPlayState();
    activate(0);
})();
