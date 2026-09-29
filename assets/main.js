(function () {
    'use strict';

    var $ = function (s, el) { return (el || document).querySelector(s); };
    var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
    var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var GH_USER = 'prathameshnium';

    /* ---------- toast + clipboard ---------- */
    var toastEl = $('#toast');
    var toastTimer;
    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2000);
    }

    function copyText(text, okMsg) {
        function fallback() {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
            toast(ok ? okMsg : 'Copy failed');
        }
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
        } else {
            fallback();
        }
    }

    /* ---------- theme ---------- */
    var root = document.documentElement;
    var themeMeta = $('meta[name="theme-color"]');
    function applyTheme(t, save) {
        root.dataset.theme = t;
        if (themeMeta) themeMeta.content = t === 'light' ? '#f6f7fb' : '#111827';
        if (save) { try { localStorage.setItem('theme', t); } catch (e) {} }
        document.dispatchEvent(new CustomEvent('themechange'));
    }
    applyTheme(root.dataset.theme || 'dark', false);
    $('#theme-toggle').addEventListener('click', function () {
        applyTheme(root.dataset.theme === 'light' ? 'dark' : 'light', true);
    });

    /* ---------- nav: mobile menu, scroll progress, active link ---------- */
    var nav = $('#nav');
    var menuBtn = $('#menu-btn');
    function setMenu(open) {
        nav.classList.toggle('open', open);
        menuBtn.setAttribute('aria-expanded', String(open));
    }
    menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
    $$('#nav-links a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

    var progress = $('#progress');
    var toTop = $('#to-top');
    var ticking = false;
    function onScroll() {
        var max = document.documentElement.scrollHeight - innerHeight;
        progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(scrollY / max, 1) : 0) + ')';
        toTop.classList.toggle('show', scrollY > 600);
        ticking = false;
    }
    addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();
    toTop.addEventListener('click', function () { scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); });

    if ('IntersectionObserver' in window) {
        var links = {};
        $$('#nav-links a[href^="#"]').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
        var spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                Object.keys(links).forEach(function (id) { links[id].classList.toggle('active', id === en.target.id); });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });

        var reveal = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { en.target.classList.add('in'); reveal.unobserve(en.target); }
            });
        }, { threshold: 0.12 });
        $$('.reveal').forEach(function (el) { reveal.observe(el); });
    } else {
        $$('.reveal').forEach(function (el) { el.classList.add('in'); });
    }

    /* ---------- email (assembled here so it is not sitting in the HTML) ---------- */
    $('#copy-mail').addEventListener('click', function () {
        copyText('prathameshnium' + '@' + 'duck' + '.' + 'com', 'Email copied');
    });

    /* ---------- rotating tagline ---------- */
    (function () {
        var el = $('#rot');
        if (reduceMotion) return;
        var words = ['lab automation', 'instrument control', 'cryogenic transport measurements', 'data analysis', 'local AI tools'];
        var w = 0, i = words[0].length, deleting = true;
        function tick() {
            var word = words[w];
            if (deleting) {
                i--;
                if (i <= 0) { deleting = false; w = (w + 1) % words.length; i = 0; }
            } else {
                i++;
                if (i >= words[w].length) { deleting = true; el.textContent = words[w]; return setTimeout(tick, 2200); }
            }
            el.textContent = words[w].slice(0, i) || ' ';
            setTimeout(tick, deleting ? 35 : 70);
        }
        setTimeout(tick, 2200);
    })();

    /* ---------- spin field (hero canvas) ---------- */
    var field = (function () {
        var canvas = $('#field');
        var hero = $('#about');
        var tempIn = $('#temp');
        var tempOut = $('#temp-out');
        var ctx = canvas.getContext('2d');
        var GAP = 34, LEN = 11;
        var W = 0, H = 0, cells = [], pulses = [];
        var mouse = null, T = +tempIn.value / 100, t = 0, last = 0;
        var color = '#f6ad55', running = false, visible = true;

        function readColor() { color = getComputedStyle(root).getPropertyValue('--accent').trim() || color; }
        readColor();
        document.addEventListener('themechange', function () { readColor(); if (!running) draw(); });

        function build() {
            var r = hero.getBoundingClientRect();
            var dpr = Math.min(devicePixelRatio || 1, 2);
            W = r.width; H = r.height;
            canvas.width = W * dpr; canvas.height = H * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            cells = [];
            for (var y = GAP / 2; y < H; y += GAP) {
                for (var x = GAP / 2; x < W; x += GAP) {
                    cells.push({ x: x, y: y, a: Math.random() * Math.PI * 2, ph: Math.random() * 6.283 });
                }
            }
        }

        function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = color;
            // Below T_c (0.5) spins follow the field; above it the order melts.
            var order = Math.max(0, 1 - T / 0.5);
            var wobble = T * T * 2.4 + T * 0.4;
            var idle = t * 0.25 - Math.PI / 2;
            for (var i = 0; i < pulses.length; i++) pulses[i].r = (t - pulses[i].t0) * 520;
            pulses = pulses.filter(function (p) { return p.r < Math.max(W, H) * 1.2; });

            for (var k = 0; k < cells.length; k++) {
                var c = cells[k];
                var base = mouse ? Math.atan2(mouse.y - c.y, mouse.x - c.x) : idle + c.x * 0.004;
                var target = base
                    + Math.sin(t * (1 + T * 2.5) + c.ph * 5) * Math.PI * wobble
                    + Math.sin(c.ph * 97 + Math.floor(t * 1.5)) * Math.PI * Math.max(0, T - 0.5) * 2;
                // A click sends a ring across the lattice that kicks spins out of alignment.
                for (var p = 0; p < pulses.length; p++) {
                    var d = Math.hypot(c.x - pulses[p].x, c.y - pulses[p].y) - pulses[p].r;
                    if (Math.abs(d) < 60) target += Math.cos(d / 60 * Math.PI / 2) * Math.PI * 0.9;
                }
                c.a += wrap(target - c.a) * (0.06 + 0.14 * order);
                var align = Math.cos(wrap(c.a - base)) * 0.5 + 0.5;
                ctx.globalAlpha = 0.18 + 0.6 * align * (0.35 + 0.65 * order) + 0.12 * (1 - order);
                var dx = Math.cos(c.a) * LEN / 2, dy = Math.sin(c.a) * LEN / 2;
                ctx.beginPath();
                ctx.moveTo(c.x - dx, c.y - dy);
                ctx.lineTo(c.x + dx, c.y + dy);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        function frame(now) {
            if (!running) return;
            t += Math.min((now - last) / 1000, 0.05);
            last = now;
            draw();
            requestAnimationFrame(frame);
        }
        function start() {
            if (running || reduceMotion || !visible || document.hidden) return;
            running = true; last = performance.now(); requestAnimationFrame(frame);
        }
        function stop() { running = false; }

        function label() {
            var phase = T < 0.4 ? 'ordered' : T < 0.6 ? 'near the critical point' : 'disordered';
            tempOut.innerHTML = T.toFixed(2) + ' T<sub>c</sub> &middot; ' + (T < 0.4 ? 'ordered' : T < 0.6 ? 'critical' : 'paramagnetic');
            tempIn.setAttribute('aria-valuetext', T.toFixed(2) + ' of the critical temperature, ' + phase);
        }
        function setT(v) { T = Math.max(0, Math.min(1, v)); tempIn.value = Math.round(T * 100); label(); if (!running) draw(); }
        tempIn.addEventListener('input', function () { setT(+tempIn.value / 100); });

        function local(e) { var r = hero.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
        hero.addEventListener('pointermove', function (e) { mouse = local(e); if (!running) draw(); });
        hero.addEventListener('pointerleave', function () { mouse = null; });
        hero.addEventListener('pointerdown', function (e) {
            if (e.target.closest('a, button, input, label')) return;
            kick(local(e));
        });
        function kick(pt) { pulses.push({ x: pt.x, y: pt.y, t0: t, r: 0 }); if (!running) { t += 0.4; draw(); } }

        addEventListener('resize', function () { build(); if (!running) draw(); });
        document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (es) {
                visible = es[0].isIntersecting;
                visible ? start() : stop();
            }).observe(hero);
        }

        build(); label(); draw(); start();

        return {
            setT: setT,
            getT: function () { return T; },
            kickAt: function (x, y) { kick({ x: x, y: y }); },
            size: function () { return { w: W, h: H }; }
        };
    })();

    $('#avatar').addEventListener('click', function () {
        var a = this.getBoundingClientRect(), h = $('#about').getBoundingClientRect();
        field.kickAt(a.left - h.left + a.width / 2, a.top - h.top + a.height / 2);
    });

    /* ---------- konami: heat the lattice, then let it cool ---------- */
    (function () {
        var seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        var pos = 0, cooling = 0;
        document.addEventListener('keydown', function (e) {
            var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            pos = key === seq[pos] ? pos + 1 : (key === seq[0] ? 1 : 0);
            if (pos < seq.length) return;
            pos = 0;
            scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
            var start = field.getT();
            field.setT(1);
            toast('Quench! Cooling back down…');
            clearInterval(cooling);
            setTimeout(function () {
                cooling = setInterval(function () {
                    var next = field.getT() - 0.02;
                    if (next <= start) { field.setT(start); clearInterval(cooling); } else { field.setT(next); }
                }, 50);
            }, 1500);
        });
    })();

    /* ---------- project filters ---------- */
    (function () {
        var buttons = $$('.filter');
        var cards = $$('.card[data-tags]');
        var count = $('#count');
        var moreHead = $('.sub-head');
        var moreCards = $$('.grid.more .card');
        function apply(tag) {
            var shown = 0;
            cards.forEach(function (c) {
                var ok = tag === 'all' || c.dataset.tags.split(' ').indexOf(tag) !== -1;
                c.hidden = !ok;
                if (ok) { shown++; c.classList.add('in'); }
            });
            buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.filter === tag)); });
            moreHead.hidden = !moreCards.some(function (c) { return !c.hidden; });
            count.textContent = tag === 'all' ? '' : 'Showing ' + shown + ' of ' + cards.length + ' projects';
        }
        buttons.forEach(function (b) { b.addEventListener('click', function () { apply(b.dataset.filter); }); });
    })();

    /* ---------- citations: version tabs + copy ---------- */
    $$('.cite').forEach(function (box) {
        var tabs = $$('.cite-tabs button', box);
        var panes = $$('.cite-box', box);
        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t === tab)); });
                panes.forEach(function (p) { p.hidden = p.dataset.citeBox !== tab.dataset.cite; });
            });
        });
        $$('[data-copy]', box).forEach(function (btn) {
            btn.addEventListener('click', function () {
                copyText($('pre', btn.parentNode).textContent, 'Citation copied');
            });
        });
    });

    /* ---------- Tupper's formula mini demo ---------- */
    (function () {
        var canvas = $('#tupper'), input = $('#tupper-in'), kOut = $('#tupper-k');
        if (!canvas || typeof BigInt === 'undefined') return;
        var ctx = canvas.getContext('2d');
        var W = 106, H = 17, N = 0n, shown = W, raf = 0;
        var scratch = document.createElement('canvas');
        scratch.width = W; scratch.height = H;
        var sctx = scratch.getContext('2d', { willReadFrequently: true });

        // Bitmap -> N. Tupper's k is 17 * N; pixel (x, j) is bit 17x + j of N.
        function encode(text) {
            sctx.clearRect(0, 0, W, H);
            sctx.font = 'bold 14px ui-sans-serif, Arial, sans-serif';
            sctx.textAlign = 'center';
            sctx.textBaseline = 'middle';
            sctx.fillStyle = '#000';
            sctx.fillText(text, W / 2, H / 2 + 1, W - 2);
            var px = sctx.getImageData(0, 0, W, H).data, n = 0n;
            for (var x = 0; x < W; x++) {
                for (var row = 0; row < H; row++) {
                    if (px[(row * W + x) * 4 + 3] > 110) n |= 1n << BigInt(17 * x + (H - 1 - row));
                }
            }
            return n;
        }

        // N -> pixels, using exactly the formula: 1/2 < floor(mod(floor(y/17) * 2^(-17x - mod(y,17)), 2)).
        function draw() {
            var accent = getComputedStyle(root).getPropertyValue('--accent').trim() || '#f6ad55';
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = accent;
            for (var x = 0; x < shown; x++) {
                for (var j = 0; j < H; j++) {
                    if ((N >> BigInt(17 * x + j)) & 1n) ctx.fillRect(x, H - 1 - j, 1, 1);
                }
            }
        }

        function update() {
            N = encode(input.value || ' ');
            var k = (N * 17n).toString();
            kOut.textContent = k === '0' ? '0' : k.slice(0, 18) + '… (' + k.length + ' digits)';
            cancelAnimationFrame(raf);
            if (reduceMotion) { shown = W; draw(); return; }
            shown = 0;
            (function sweep() { shown = Math.min(W, shown + 4); draw(); if (shown < W) raf = requestAnimationFrame(sweep); })();
        }
        input.addEventListener('input', update);
        document.addEventListener('themechange', draw);
        update();
    })();

    /* ---------- live GitHub activity ---------- */
    (function () {
        var body = $('#activity-body');
        var status = $('#activity-status');
        var colors = {
            Python: '#3572A5', JavaScript: '#f1e05a', HTML: '#e34c26', CSS: '#7b5ea7', TeX: '#3D6117',
            'Jupyter Notebook': '#DA5B0B', MATLAB: '#e16737', Shell: '#89e051', TypeScript: '#3178c6',
            C: '#8b949e', 'C++': '#f34b7d', Batchfile: '#C1F12E', PowerShell: '#5391FE'
        };
        var fallback = ['#f6ad55', '#63b3ed', '#68d391', '#f687b3', '#b794f4', '#fc8181'];

        function getJSON(url, key) {
            try {
                var hit = JSON.parse(sessionStorage.getItem(key) || 'null');
                if (hit && Date.now() - hit.at < 10 * 60 * 1000) return Promise.resolve(hit.data);
            } catch (e) {}
            return fetch(url, { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) {
                if (!r.ok) throw new Error(r.status);
                return r.json();
            }).then(function (data) {
                try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data: data })); } catch (e) {}
                return data;
            });
        }

        function countUp(el, to) {
            if (reduceMotion || to === 0) { el.textContent = to; return; }
            var t0 = performance.now();
            (function step(now) {
                var p = Math.min((now - t0) / 900, 1);
                el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
                if (p < 1) requestAnimationFrame(step);
            })(t0);
        }

        function ago(iso) {
            var d = Math.floor((Date.now() - new Date(iso)) / 864e5);
            if (d < 1) return 'today';
            if (d < 31) return d + (d === 1 ? ' day ago' : ' days ago');
            var m = Math.floor(d / 30);
            return m < 12 ? m + (m === 1 ? ' month ago' : ' months ago') : Math.floor(m / 12) + ' yr ago';
        }

        function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

        Promise.all([
            getJSON('https://api.github.com/users/' + GH_USER, 'gh-user'),
            getJSON('https://api.github.com/users/' + GH_USER + '/repos?per_page=100&sort=pushed', 'gh-repos')
        ]).then(function (res) {
            var user = res[0];
            // Skip forks and the profile-README repo, which is not a project.
            var repos = res[1].filter(function (r) { return !r.fork && r.name !== GH_USER; });

            var stars = repos.reduce(function (n, r) { return n + r.stargazers_count; }, 0);
            body.hidden = false;
            status.hidden = true;
            countUp($('[data-stat="repos"]'), user.public_repos);
            countUp($('[data-stat="stars"]'), stars);
            countUp($('[data-stat="followers"]'), user.followers);

            var langs = {};
            repos.forEach(function (r) { if (r.language) langs[r.language] = (langs[r.language] || 0) + 1; });
            var names = Object.keys(langs).sort(function (a, b) { return langs[b] - langs[a]; });
            var bar = $('#langbar'), legend = $('#legend');
            names.forEach(function (n, i) {
                var c = colors[n] || fallback[i % fallback.length];
                bar.insertAdjacentHTML('beforeend', '<i style="flex-grow:' + langs[n] + ';background:' + c + '" title="' + esc(n) + '"></i>');
                legend.insertAdjacentHTML('beforeend', '<span style="--c:' + c + '">' + esc(n) + ' (' + langs[n] + ')</span>');
            });

            var recent = $('#recent');
            repos.slice(0, 5).forEach(function (r) {
                recent.insertAdjacentHTML('beforeend',
                    '<li><a href="' + esc(r.html_url) + '" target="_blank" rel="noopener noreferrer">' + esc(r.name) +
                    '</a><time datetime="' + esc(r.pushed_at) + '">' + ago(r.pushed_at) + '</time></li>');
            });

            // Star counts on the project cards.
            var byName = {};
            repos.forEach(function (r) { byName[r.name] = r; });
            $$('.card[data-repo]').forEach(function (card) {
                var r = byName[card.dataset.repo];
                if (r && r.stargazers_count > 0) {
                    $('.tags', card).insertAdjacentHTML('beforeend',
                        '<span class="stars" title="GitHub stars">★ ' + r.stargazers_count + '</span>');
                }
            });
        }).catch(function () {
            status.innerHTML = 'Could not load live stats right now (GitHub API rate limit or offline). ' +
                '<a href="https://github.com/' + GH_USER + '" target="_blank" rel="noopener noreferrer">See my GitHub profile</a>.';
        });
    })();
})();
