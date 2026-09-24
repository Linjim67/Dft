/* ============================================================
   安心陪伴 — 01. 基本資料頁邏輯
   純前端、無須登入：以 localStorage 保存 24 小時內的暫時帳號。
   ============================================================ */
(() => {
    'use strict';

    const STORAGE_KEY = 'notcry_patient_session_v1';
    const DAY_MS = 24 * 60 * 60 * 1000;

    const form = document.getElementById('personalInfoForm');
    const formView = document.getElementById('formView');
    const successView = document.getElementById('successView');
    const errorSummary = document.getElementById('errorSummary');
    const errorList = document.getElementById('errorList');
    const nicknameInput = document.getElementById('nickname');
    const specialNeedsInput = document.getElementById('specialNeeds');
    const ageIndexInput = document.getElementById('ageIndex');
    const ageBubble = document.getElementById('ageBubble');
    const ageOut = document.getElementById('ageOut');
    const fearScaleEl = document.getElementById('fearScale');
    const worryScaleEl = document.getElementById('worryScale');
    const codeDigits = document.getElementById('codeDigits');
    const codeExpiry = document.getElementById('codeExpiry');
    const summaryCard = document.getElementById('summaryCard');
    const successHeading = document.getElementById('successHeading');
    const restartBtn = document.getElementById('restartBtn');

    let ageTouched = false;

    // ---------- 年紀滑桿：0–6 歲以 0.5 為單位，6–18 歲以 1 為單位 ----------
    const AGE_VALUES = [];
    for (let i = 0; i <= 12; i++) AGE_VALUES.push(i * 0.5); // 0, 0.5, ... 6
    for (let a = 7; a <= 18; a++) AGE_VALUES.push(a); // 7, 8, ... 18

    function ageValueFromIndex(index) {
        const clamped = Math.min(Math.max(index, 0), AGE_VALUES.length - 1);
        return AGE_VALUES[clamped];
    }

    function formatAge(value) {
        const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
        return `${text} 歲`;
    }

    function positionBubble() {
        const max = Number(ageIndexInput.max) || 1;
        const percent = Number(ageIndexInput.value) / max;
        const trackWidth = ageIndexInput.offsetWidth;
        const thumbSize = 26;
        const offset = (thumbSize / 2) + percent * Math.max(trackWidth - thumbSize, 0);
        ageBubble.style.left = `${offset}px`;
    }

    ageIndexInput.addEventListener('pointerdown', () => {
        ageBubble.classList.add('is-visible');
    });

    // 拖曳中：只更新浮動泡泡，尚未定案
    ageIndexInput.addEventListener('input', () => {
        ageTouched = true;
        ageBubble.textContent = formatAge(ageValueFromIndex(Number(ageIndexInput.value)));
        positionBubble();
        ageBubble.classList.add('is-visible');
    });

    // 放開手指／滑鼠（或鍵盤操作完成一步）：定案並顯示於下方
    ageIndexInput.addEventListener('change', () => {
        ageTouched = true;
        ageOut.textContent = formatAge(ageValueFromIndex(Number(ageIndexInput.value)));
        ageBubble.classList.remove('is-visible');
        clearFieldError('age');
    });

    window.addEventListener('resize', positionBubble);

    // ---------- 表情量表（害怕程度／擔心程度） ----------
    const FACE_LEVELS = [
        { value: 1, mouth: 'M7.5 13.5c1.8 2.4 7.2 2.4 9 0', brow: 'M7.5 8.3q1.5-1 3 0M13.5 8.3q1.5-1 3 0' },
        { value: 2, mouth: 'M8 14c1.3 1.3 6.7 1.3 8 0', brow: 'M7.5 8.2q1.5-.6 3 0M13.5 8.2q1.5-.6 3 0' },
        { value: 3, mouth: 'M8 15h8', brow: 'M7.5 8.3h3M13.5 8.3h3' },
        { value: 4, mouth: 'M8 16.3c1.3-1.3 6.7-1.3 8 0', brow: 'M7.3 8.6 10.3 9.4M16.7 8.6 13.7 9.4' },
        { value: 5, mouth: 'M7.5 17c1.8-2.4 7.2-2.4 9 0', brow: 'M7 8.8 10.4 9.8M17 8.8 13.6 9.8' },
    ];

    function faceSvg(level) {
        return `<svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9.25"></circle>
            <circle class="pupil" cx="9" cy="10.4" r="1"></circle>
            <circle class="pupil" cx="15" cy="10.4" r="1"></circle>
            <path d="${level.brow}"></path>
            <path d="${level.mouth}"></path>
        </svg>`;
    }

    function buildFaceScale(container, groupName, describedById) {
        container.innerHTML = FACE_LEVELS.map((level) => `
            <label class="face-option">
                <input type="radio" name="${groupName}" value="${level.value}" required aria-describedby="${describedById}">
                <span class="face-icon-wrap">${faceSvg(level)}</span>
                <span class="face-num">${level.value}</span>
            </label>
        `).join('');
    }

    buildFaceScale(fearScaleEl, 'fearLevel', 'fearLevel-error');
    buildFaceScale(worryScaleEl, 'worryLevel', 'worryLevel-error');

    form.querySelectorAll('input[type="radio"]').forEach((input) => {
        input.addEventListener('change', () => clearFieldError(input.name));
    });

    // ---------- 欄位錯誤顯示／清除 ----------
    function showFieldError(key, message) {
        const errorEl = document.getElementById(`${key}-error`);
        if (!errorEl) return;
        errorEl.textContent = message;
        errorEl.hidden = false;
        const field = errorEl.closest('.field');
        if (field) field.classList.add('has-error');
    }

    function clearFieldError(key) {
        const errorEl = document.getElementById(`${key}-error`);
        if (!errorEl) return;
        errorEl.hidden = true;
        errorEl.textContent = '';
        const field = errorEl.closest('.field');
        if (field) field.classList.remove('has-error');
    }

    nicknameInput.addEventListener('blur', () => {
        if (nicknameInput.value.trim() === '') {
            showFieldError('nickname', '請填寫小孩的暱稱');
        } else {
            clearFieldError('nickname');
        }
    });
    nicknameInput.addEventListener('input', () => {
        if (nicknameInput.value.trim() !== '') clearFieldError('nickname');
    });

    // ---------- 送出驗證 ----------
    const FIELD_LABELS = {
        nickname: '小孩的暱稱',
        age: '小孩的年紀',
        gender: '小孩的性別',
        fearLevel: '小孩會害怕抽血嗎',
        worryLevel: '家長會擔心小孩嗎',
    };

    function focusFieldByKey(key) {
        let el = null;
        if (key === 'nickname') el = nicknameInput;
        else if (key === 'age') el = ageIndexInput;
        else el = form.querySelector(`input[name="${key}"]`);
        if (el) {
            el.focus();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function validateForm() {
        const errors = [];
        if (nicknameInput.value.trim() === '') {
            errors.push({ key: 'nickname', message: '請填寫小孩的暱稱' });
        }
        if (!ageTouched) {
            errors.push({ key: 'age', message: '請拖曳滑桿選擇小孩的年紀' });
        }
        if (!form.querySelector('input[name="gender"]:checked')) {
            errors.push({ key: 'gender', message: '請選擇小孩的性別' });
        }
        if (!form.querySelector('input[name="fearLevel"]:checked')) {
            errors.push({ key: 'fearLevel', message: '請選擇小孩害怕抽血的程度' });
        }
        if (!form.querySelector('input[name="worryLevel"]:checked')) {
            errors.push({ key: 'worryLevel', message: '請選擇家長擔心的程度' });
        }
        return errors;
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const errors = validateForm();

        Object.keys(FIELD_LABELS).forEach((key) => {
            const hit = errors.find((error) => error.key === key);
            if (hit) showFieldError(key, hit.message);
            else clearFieldError(key);
        });

        if (errors.length > 0) {
            errorList.innerHTML = errors
                .map((error) => `<li><a href="#" data-key="${error.key}">${FIELD_LABELS[error.key]}：${error.message}</a></li>`)
                .join('');
            errorList.querySelectorAll('a').forEach((a) => {
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    focusFieldByKey(a.dataset.key);
                });
            });
            errorSummary.hidden = false;
            errorSummary.focus();
            return;
        }

        errorSummary.hidden = true;
        submitForm();
    });

    // ---------- 暫時代碼（簡易雜湊，4 碼十進位） ----------
    function generateTempCode() {
        const raw = `${Date.now()}-${Math.random()}-${navigator.userAgent}`;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            hash = (hash << 5) - hash + raw.charCodeAt(i);
            hash |= 0;
        }
        const code = Math.abs(hash) % 10000;
        return String(code).padStart(4, '0');
    }

    function saveSession(session) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        } catch (err) {
            console.warn('無法儲存到 localStorage，本次僅在畫面上顯示結果。', err);
        }
    }

    function loadSession() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const session = JSON.parse(raw);
            if (!session.expiresAt || Date.now() > session.expiresAt) {
                localStorage.removeItem(STORAGE_KEY);
                return null;
            }
            return session;
        } catch (err) {
            return null;
        }
    }

    function submitForm() {
        const session = {
            code: generateTempCode(),
            nickname: nicknameInput.value.trim(),
            age: ageValueFromIndex(Number(ageIndexInput.value)),
            gender: form.querySelector('input[name="gender"]:checked').value,
            fearLevel: Number(form.querySelector('input[name="fearLevel"]:checked').value),
            worryLevel: Number(form.querySelector('input[name="worryLevel"]:checked').value),
            specialNeeds: specialNeedsInput.value.trim(),
            createdAt: Date.now(),
            expiresAt: Date.now() + DAY_MS,
        };
        saveSession(session);
        showSuccess(session);
    }

    // ---------- 完成畫面 ----------
    const GENDER_LABEL = { 男: '男孩', 女: '女孩' };
    const LEVEL_LABEL = { 1: '1（最不會）', 2: '2', 3: '3（普通）', 4: '4', 5: '5（最會）' };

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showSuccess(session) {
        formView.hidden = true;
        successView.hidden = false;

        successHeading.textContent = `${session.nickname}，準備好了`;
        codeDigits.textContent = session.code;

        const expiry = new Date(session.expiresAt);
        const hh = String(expiry.getHours()).padStart(2, '0');
        const mm = String(expiry.getMinutes()).padStart(2, '0');
        codeExpiry.textContent = `有效至 ${expiry.getMonth() + 1}/${expiry.getDate()} ${hh}:${mm}`;

        const rows = [
            ['暱稱', session.nickname],
            ['年紀', formatAge(session.age)],
            ['性別', GENDER_LABEL[session.gender] || session.gender],
            ['害怕抽血程度', LEVEL_LABEL[session.fearLevel]],
            ['家長擔心程度', LEVEL_LABEL[session.worryLevel]],
        ];
        if (session.specialNeeds) rows.push(['特殊需求', session.specialNeeds]);

        summaryCard.innerHTML = rows
            .map(([label, value]) => `
                <div class="summary-row">
                    <dt>${escapeHtml(label)}</dt>
                    <dd>${escapeHtml(String(value))}</dd>
                </div>
            `)
            .join('');

        successHeading.focus();
    }

    restartBtn.addEventListener('click', () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
            /* ignore */
        }
        form.reset();
        ageTouched = false;
        ageOut.textContent = '尚未選擇，請拖曳滑桿';
        ageBubble.classList.remove('is-visible');
        form.querySelectorAll('.field-error').forEach((el) => {
            el.hidden = true;
            el.textContent = '';
        });
        form.querySelectorAll('.field').forEach((el) => el.classList.remove('has-error'));
        errorSummary.hidden = true;

        successView.hidden = true;
        formView.hidden = false;
        nicknameInput.focus();
    });

    // ---------- 初始化 ----------
    positionBubble();
    const existingSession = loadSession();
    if (existingSession) {
        showSuccess(existingSession);
    }
})();
