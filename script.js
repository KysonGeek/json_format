document.addEventListener('DOMContentLoaded', async function() {
    // 获取DOM元素
    const editor = document.getElementById('editor');
    const jsonDisplay = document.getElementById('jsonDisplay');
    const lineNumbers = document.getElementById('lineNumbers');
    const status = document.getElementById('status');
    const validateBtn = document.getElementById('validateBtn');
    const compressBtn = document.getElementById('compressBtn');
    const escapeBtn = document.getElementById('escapeBtn');
    const unescapeBtn = document.getElementById('unescapeBtn');
    const base64DecodeBtn = document.getElementById('base64DecodeBtn');
    const lombokToJsonBtn = document.getElementById('lombokToJsonBtn');
    const timeConverterBtn = document.getElementById('timeConverterBtn');
    const timeConvertBtn = document.getElementById('timeConvertBtn');
    const timestampInput = document.getElementById('timestampInput');
    const timeInput = document.getElementById('timeInput');
    const timeZoneOffsetSelect = document.getElementById('timeZoneOffsetSelect');
    const timestampUnitSelect = document.getElementById('timestampUnitSelect');
    const copyBtn = document.getElementById('copyBtn');
    const diffBtn = document.getElementById('diffBtn');
    const diffContainer = document.getElementById('diffContainer');
    const diffFrame = document.getElementById('diffFrame');
    const editorContainer = document.querySelector('.editor-container');
    const timeConverter = document.querySelector('.time-converter');
    let isSyncingTimeScroll = false;

    // 更新行号
    function switchToEditor() {
        diffContainer.style.display = 'none';
        diffContainer.classList.add('hidden');
        if (timeConverter) timeConverter.classList.add('hidden');
        editorContainer.style.display = 'flex';
        jsonDisplay.style.display = 'none';
        editor.style.display = 'block';
    }

    function showTimeConverter() {
        if (timeConverter) timeConverter.classList.remove('hidden');
        diffContainer.style.display = 'none';
        diffContainer.classList.add('hidden');
        editorContainer.style.display = 'none';
        jsonDisplay.style.display = 'none';
        editor.style.display = 'none';
        status.classList.add('hidden');
    }

    function syncTimePanelScroll(source, target) {
        if (!source || !target || isSyncingTimeScroll) return;
        isSyncingTimeScroll = true;
        target.scrollTop = source.scrollTop;
        target.scrollLeft = source.scrollLeft;
        requestAnimationFrame(() => {
            isSyncingTimeScroll = false;
        });
    }

    if (timestampInput && timeInput) {
        timestampInput.addEventListener('scroll', () => syncTimePanelScroll(timestampInput, timeInput));
        timeInput.addEventListener('scroll', () => syncTimePanelScroll(timeInput, timestampInput));
    }

    function resetTimePanelPosition() {
        if (timestampInput) {
            timestampInput.scrollTop = 0;
            timestampInput.scrollLeft = 0;
            timestampInput.selectionStart = 0;
            timestampInput.selectionEnd = 0;
        }
        if (timeInput) {
            timeInput.scrollTop = 0;
            timeInput.scrollLeft = 0;
            timeInput.selectionStart = 0;
            timeInput.selectionEnd = 0;
        }
    }
    function updateLineNumbers() {
        const lines = editor.value.split('\n');
        lineNumbers.innerHTML = lines.map((_, i) => `<div style="line-height: 1.5; padding: 0; margin: 0;">${i + 1}</div>`).join('');
    }

    // 初始化行号
    updateLineNumbers();

    function formatOffsetLabel(offset) {
        if (offset === 0) return '+0';
        return offset > 0 ? `+${offset}` : `${offset}`;
    }

    function populateTimeZoneOffsets() {
        if (!timeZoneOffsetSelect) return;
        const options = [];
        for (let i = -12; i <= 14; i += 1) {
            options.push(formatOffsetLabel(i));
        }
        timeZoneOffsetSelect.innerHTML = options.map(offset => `<option value="${offset}">${offset}</option>`).join('');
        timeZoneOffsetSelect.value = '+8';
    }

    populateTimeZoneOffsets();

    // 动态加载本地打包的 VSCode JSON 服务
    const { getLanguageService, TextDocument } = await import('./vendor/json-service.bundle.js');

    // 监听输入更新行号
    editor.addEventListener('input', updateLineNumbers);
    
    // 同步滚动
    const foldButtons = document.getElementById('foldButtons');
    editor.addEventListener('scroll', function() {
        lineNumbers.scrollTop = editor.scrollTop;
        if (foldButtons) foldButtons.scrollTop = editor.scrollTop;
    });
    
    // JSON显示区域滚动时同步行号和折叠按钮
    jsonDisplay.addEventListener('scroll', function() {
        lineNumbers.scrollTop = jsonDisplay.scrollTop;
        if (foldButtons) foldButtons.scrollTop = jsonDisplay.scrollTop;
    });

    function applyEdits(text, edits) {
        let result = text;
        const doc = TextDocument.create('inmemory://model/1', 'json', 1, text);
        for (let i = edits.length - 1; i >= 0; i--) {
            const edit = edits[i];
            const startOffset = doc.offsetAt(edit.range.start);
            const endOffset = doc.offsetAt(edit.range.end);
            result = result.substring(0, startOffset) + edit.newText + result.substring(endOffset);
        }
        return result;
    }

    function formatIncompleteJson(incompleteJsonString) {
        const jsonService = getLanguageService({});
        const document = TextDocument.create('inmemory://model/1', 'json', 1, incompleteJsonString);
        const formattingOptions = { tabSize: 4, insertSpaces: true, trimTrailingWhitespace: true, insertFinalNewline: false };
        const range = { start: { line: 0, character: 0 }, end: document.positionAt(incompleteJsonString.length) };
        const edits = jsonService.format(document, range, formattingOptions);
        return applyEdits(incompleteJsonString, edits);
    }

    function parseOffsetHours(offsetText) {
        if (typeof offsetText !== 'string') return 0;
        const trimmed = offsetText.trim();
        if (trimmed === '0') return 0;
        const match = trimmed.match(/^([+-])(\d{1,2})$/);
        if (!match) return 0;
        const hours = Number(match[2]);
        if (!Number.isFinite(hours)) return 0;
        return match[1] === '-' ? -hours : hours;
    }

    function formatWithOffset(timestampMs, offsetHours) {
        const date = new Date(timestampMs + offsetHours * 3600 * 1000);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hour = String(date.getUTCHours()).padStart(2, '0');
        const minute = String(date.getUTCMinutes()).padStart(2, '0');
        const second = String(date.getUTCSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }

    function parseTimestampToMs(input, unit) {
        const trimmed = input.trim();
        if (!/^-?\d+$/.test(trimmed)) return null;
        const numberValue = Number(trimmed);
        if (!Number.isFinite(numberValue)) return null;
        if (unit === 'seconds') return numberValue * 1000;
        if (unit === 'milliseconds') return numberValue;
        const digits = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
        if (digits.length === 10) return numberValue * 1000;
        if (digits.length === 13) return numberValue;
        return numberValue;
    }

    function parseDateTimeParts(input) {
        const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
        if (!match) return null;
        return {
            year: Number(match[1]),
            month: Number(match[2]),
            day: Number(match[3]),
            hour: Number(match[4]),
            minute: Number(match[5]),
            second: Number(match[6])
        };
    }

    function isValidDateParts(parts) {
        const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
        return date.getUTCFullYear() === parts.year
            && date.getUTCMonth() === parts.month - 1
            && date.getUTCDate() === parts.day
            && date.getUTCHours() === parts.hour
            && date.getUTCMinutes() === parts.minute
            && date.getUTCSeconds() === parts.second;
    }

    function convertTimestampsToTime(lines, offsetHours, unit) {
        let invalidCount = 0;
        const output = lines.map(line => {
            if (line.trim() === '') return '';
            const ms = parseTimestampToMs(line, unit);
            if (ms === null || !Number.isFinite(ms)) {
                invalidCount += 1;
                return `无效: ${line}`;
            }
            const date = new Date(ms);
            if (isNaN(date.getTime())) {
                invalidCount += 1;
                return `无效: ${line}`;
            }
            return formatWithOffset(ms, offsetHours);
        });
        return { output, invalidCount };
    }

    function convertTimesToTimestamp(lines, offsetHours, unit) {
        let invalidCount = 0;
        const output = lines.map(line => {
            if (line.trim() === '') return '';
            const parts = parseDateTimeParts(line);
            if (!parts || !isValidDateParts(parts)) {
                invalidCount += 1;
                return `无效: ${line}`;
            }
            const offsetMs = offsetHours * 3600 * 1000;
            const timestampMs = Date.UTC(
                parts.year,
                parts.month - 1,
                parts.day,
                parts.hour,
                parts.minute,
                parts.second
            ) - offsetMs;
            if (!Number.isFinite(timestampMs)) {
                invalidCount += 1;
                return `无效: ${line}`;
            }
            if (unit === 'seconds') {
                return String(Math.trunc(timestampMs / 1000));
            }
            return String(timestampMs);
        });
        return { output, invalidCount };
    }

    function lombokToJson(str) {
        if (!str) return null;
        str = str.trim();
        let result = {};
        let stack = [];
        let currentKey = "";
        let buffer = "";
        let currentContainer = result;
        const flushBuffer = () => {
            let val = buffer.trim();
            if (!val) return;
            if (val === "null") val = null;
            else if (val === "true") val = true;
            else if (val === "false") val = false;
            else if (!isNaN(Number(val))) {
                if (val.length < 16) {
                    val = Number(val);
                }
            }
            if (Array.isArray(currentContainer)) {
                currentContainer.push(val);
            } else {
                if (currentKey) {
                    currentContainer[currentKey] = val;
                    currentKey = "";
                }
            }
            buffer = "";
        };
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === '(') {
                let newObj = {};
                if (Array.isArray(currentContainer)) {
                    currentContainer.push(newObj);
                } else if (currentKey) {
                    currentContainer[currentKey] = newObj;
                } else {
                    newObj = result;
                }
                stack.push({ container: currentContainer, key: currentKey });
                currentContainer = newObj;
                currentKey = "";
                buffer = "";
            } else if (char === ')') {
                flushBuffer();
                const context = stack.pop();
                if (context) {
                    currentContainer = context.container;
                    currentKey = context.key;
                    if (!Array.isArray(currentContainer)) currentKey = "";
                }
            } else if (char === '[') {
                let newArr = [];
                if (currentKey) {
                    currentContainer[currentKey] = newArr;
                }
                stack.push({ container: currentContainer, key: currentKey });
                currentContainer = newArr;
                currentKey = "";
                buffer = "";
            } else if (char === ']') {
                flushBuffer();
                const context = stack.pop();
                if (context) {
                    currentContainer = context.container;
                    currentKey = "";
                }
            } else if (char === '=' || char === ':') {
                if (!currentKey) {
                    currentKey = buffer.trim();
                    buffer = "";
                } else {
                    buffer += char;
                }
            } else if (char === ',') {
                flushBuffer();
            } else {
                buffer += char;
            }
        }
        return result;
    }

    validateBtn.addEventListener('click', function() {
        switchToEditor();
        try {
            if (editor.value.trim() === '') {
                showStatus('请输入JSON字符串', false);
                return;
            }
            const formatted = formatIncompleteJson(editor.value);
            editor.value = formatted;
            updateLineNumbers();
            showStatus('JSON格式化成功！', true);
            displayFormattedJson(formatted);
        } catch (e) {
            showStatus('JSON格式化失败：' + e.message, false);
            jsonDisplay.style.display = 'none';
            editor.style.display = 'block';
        }
    });

    // 压缩JSON
    compressBtn.addEventListener('click', function() {
        switchToEditor();
        try {
            if (editor.value.trim() === '') {
                showStatus('请输入JSON字符串', false);
                return;
            }
            
            const json = JSON.parse(editor.value);
            const compressed = JSON.stringify(json);
            editor.value = compressed;
            updateLineNumbers();
            showStatus('JSON压缩成功！', true);
            jsonDisplay.style.display = 'none';
            editor.style.display = 'block';
        } catch (e) {
            showStatus('JSON压缩失败：' + e.message, false);
        }
    });

    if (lombokToJsonBtn) lombokToJsonBtn.addEventListener('click', function() {
        switchToEditor();
        try {
            if (editor.value.trim() === '') {
                showStatus('请输入Lombok toString字符串', false);
                return;
            }
            const obj = lombokToJson(editor.value);
            const formatted = JSON.stringify(obj, null, 4);
            editor.value = formatted;
            updateLineNumbers();
            showStatus('Lombok转JSON成功！', true);
            displayFormattedJson(formatted);
        } catch (e) {
            showStatus('Lombok转JSON失败：' + e.message, false);
            jsonDisplay.style.display = 'none';
            editor.style.display = 'block';
        }
    });

    if (timeConvertBtn) timeConvertBtn.addEventListener('click', function() {
        try {
            const leftValue = timestampInput ? timestampInput.value : '';
            const rightValue = timeInput ? timeInput.value : '';
            const hasLeft = leftValue.trim() !== '';
            const hasRight = rightValue.trim() !== '';
            if (!hasLeft && !hasRight) {
                showStatus('请输入时间戳或时间字符串', false);
                return;
            }
            const offsetHours = parseOffsetHours(timeZoneOffsetSelect ? timeZoneOffsetSelect.value : '+0');
            if (hasLeft) {
                const lines = leftValue.split('\n');
                const unit = timestampUnitSelect ? timestampUnitSelect.value : 'auto';
                const { output, invalidCount } = convertTimestampsToTime(lines, offsetHours, unit);
                if (timeInput) timeInput.value = output.join('\n');
                if (invalidCount > 0) {
                    showStatus(`转换完成，${invalidCount} 行无效`, false);
                } else {
                    showStatus('时间戳转换成功！', true);
                }
                resetTimePanelPosition();
                return;
            }
            const unit = timestampUnitSelect ? timestampUnitSelect.value : 'milliseconds';
            const lines = rightValue.split('\n');
            const { output, invalidCount } = convertTimesToTimestamp(lines, offsetHours, unit);
            if (timestampInput) timestampInput.value = output.join('\n');
            if (invalidCount > 0) {
                showStatus(`转换完成，${invalidCount} 行无效`, false);
            } else {
                showStatus('时间转换成功！', true);
            }
            resetTimePanelPosition();
        } catch (e) {
            showStatus('时间转换失败：' + e.message, false);
        }
    });

    if (timeConverterBtn) timeConverterBtn.addEventListener('click', function() {
        showTimeConverter();
    });

    // 转义JSON
    escapeBtn.addEventListener('click', function() {
        switchToEditor();
        try {
            if (editor.value.trim() === '') {
                showStatus('请输入字符串', false);
                return;
            }
            
            const escaped = editor.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            editor.value = escaped;
            updateLineNumbers();
            showStatus('字符串转义成功！', true);
            jsonDisplay.style.display = 'none';
            editor.style.display = 'block';
        } catch (e) {
            showStatus('字符串转义失败：' + e.message, false);
        }
    });

    // 去除转义
    unescapeBtn.addEventListener('click', function() {
        switchToEditor();
        try {
            if (editor.value.trim() === '') {
                showStatus('请输入字符串', false);
                return;
            }
            
            const unescaped = editor.value.replace(/\\\\/g, '\\').replace(/\\"/g, '"');
            editor.value = unescaped;
            updateLineNumbers();
            showStatus('字符串去除转义成功！', true);
            jsonDisplay.style.display = 'none';
            editor.style.display = 'block';
        } catch (e) {
            showStatus('字符串去除转义失败：' + e.message, false);
        }
    });

    // 显示状态信息
    function showStatus(message, isSuccess) {
        status.textContent = message;
        status.className = isSuccess ? 'status success' : 'status error';
        status.classList.remove('hidden');
        
        // 3秒后隐藏状态信息
        setTimeout(() => {
            status.classList.add('hidden');
        }, 3000);
    }

    // 这个函数已移至下方重新实现
    // 保留此注释以避免代码结构混乱

    // 添加折叠事件监听
    function addCollapsibleEventListeners() {
        const collapsibles = jsonDisplay.querySelectorAll('.collapsible');
        collapsibles.forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                this.classList.toggle('collapsed');
                // 防止事件冒泡到jsonDisplay
                e.preventDefault();
                
                // 折叠/展开后更新行号
                setTimeout(() => {
                    // 获取当前显示的JSON文本的行数
                    const visibleLines = jsonDisplay.innerText.split('\n');
                    lineNumbers.innerHTML = visibleLines.map((_, i) => `<div>${i + 1}</div>`).join('');
                }, 0);
            });
        });
    }

    // JSON语法高亮
    function syntaxHighlight(json) {
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/(""|"(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, function (match) {
            let cls = 'json-number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'json-key';
                } else {
                    cls = 'json-string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'json-boolean';
            } else if (/null/.test(match)) {
                cls = 'json-null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    // 添加折叠功能
    function addCollapsibleFeature(highlightedJson) {
        let depth = 0;
        let inString = false;
        let result = '';
        let collapsibleStack = [];
        
        for (let i = 0; i < highlightedJson.length; i++) {
            const char = highlightedJson[i];
            
            // 处理字符串内的字符
            if (char === '"' && (i === 0 || highlightedJson[i-1] !== '\\')) {
                inString = !inString;
            }
            
            if (!inString) {
                if (char === '{' || char === '[') {
                    depth++;
                    collapsibleStack.push(depth);
                    // 添加可折叠标记和内容包装
                    result += char + '<span class="collapsible" data-depth="' + depth + '"></span><span class="collapsible-content">';
                } else if (char === '}' || char === ']') {
                    // 关闭内容包装
                    result += '</span>' + char;
                    collapsibleStack.pop();
                    depth--;
                } else {
                    result += char;
                }
            } else {
                result += char;
            }
        }
        
        return result;
    }

    // 切换回编辑模式
    jsonDisplay.addEventListener('dblclick', function(e) {
        // 如果双击的不是折叠按钮和折叠内容，则切换回编辑模式
        if (!e.target.classList.contains('collapsible') && !e.target.classList.contains('collapsible-content')) {
            jsonDisplay.style.display = 'none';
            editor.style.display = 'block';
        }
    });
    
    // 添加返回编辑模式按钮
    const returnButton = document.createElement('button');
    returnButton.textContent = '返回编辑';
    returnButton.style.position = 'absolute';
    returnButton.style.top = '5px';
    returnButton.style.right = '5px';
    returnButton.style.zIndex = '100';
    returnButton.style.display = 'none';
    document.querySelector('.editor-container').appendChild(returnButton);
    
    // 显示格式化JSON时显示返回按钮
    function showReturnButton() {
        returnButton.style.display = 'block';
        returnButton.addEventListener('click', function() {
            jsonDisplay.style.display = 'none';
            editor.style.display = 'block';
            returnButton.style.display = 'none';
        });
    }
    
    // 在显示格式化JSON时调用
    function displayFormattedJson(json) {
        // 语法高亮处理
        const highlighted = syntaxHighlight(json);
        
        // 添加折叠功能
        const withCollapsible = addCollapsibleFeature(highlighted);
        
        jsonDisplay.innerHTML = withCollapsible;
        jsonDisplay.style.display = 'block';
        editor.style.display = 'none';
        
        // 更新行号以匹配格式化后的JSON行数
        const jsonLines = json.split('\n');
        lineNumbers.innerHTML = jsonLines.map((_, i) => `<div>${i + 1}</div>`).join('');
        
        // 显示返回按钮
        showReturnButton();
        
        // 添加折叠事件监听
        addCollapsibleEventListeners();
    }
    
    // 复制JSON内容
    copyBtn.addEventListener('click', function() {
        try {
            // 判断当前显示的是编辑器还是格式化后的JSON
            const textToCopy = jsonDisplay.style.display === 'block' ? 
                              jsonDisplay.innerText : 
                              editor.value;
            
            if (textToCopy.trim() === '') {
                showStatus('没有内容可复制', false);
                return;
            }
            
            // 使用Clipboard API复制内容
            navigator.clipboard.writeText(textToCopy).then(() => {
                showStatus('复制成功！', true);
            }).catch(err => {
                showStatus('复制失败：' + err.message, false);
            });
        } catch (e) {
            showStatus('复制失败：' + e.message, false);
        }
    });
    
    // 添加键盘快捷键
    document.addEventListener('keydown', function(e) {
        // Ctrl+Enter 或 Cmd+Enter 校验格式化
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            validateBtn.click();
            e.preventDefault();
        }
        // Ctrl+Shift+C 或 Cmd+Shift+C 压缩
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
            compressBtn.click();
            e.preventDefault();
        }
        // Ctrl+C 或 Cmd+C 复制（当按下Alt键时）
        else if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'c') {
            copyBtn.click();
            e.preventDefault();
        }
    });
    // Base64解密功能
    base64DecodeBtn.addEventListener('click', function() {
        switchToEditor();
        try {
            if (editor.value.trim() === '') {
                showStatus('请输入Base64编码字符串', false);
                return;
            }
            
            // 尝试Base64解码
            const encodedStr = editor.value.trim();
            const decodedStr = atob(encodedStr);
            
            editor.value = decodedStr;
            updateLineNumbers();
            showStatus('Base64解密成功！', true);
            jsonDisplay.style.display = 'none';
            editor.style.display = 'block';
            
            // 如果解密结果是有效的JSON，自动格式化
            try {
                const json = JSON.parse(decodedStr);
                const formatted = JSON.stringify(json, null, 4);
                editor.value = formatted;
                updateLineNumbers();
                showStatus('Base64解密成功，并且已自动格式化JSON！', true);
            } catch (e) {
                // 如果不是JSON，保持原样
                console.warn('解密结果不是有效的JSON:', e);
            }
        } catch (e) {
            showStatus('Base64解密失败：' + e.message, false);
        }
    });
    diffBtn.addEventListener('click', function() {
        if (timeConverter) timeConverter.classList.add('hidden');
        diffContainer.classList.remove('hidden');
        diffContainer.style.display = 'block';
        editorContainer.style.display = 'none';
        jsonDisplay.style.display = 'none';
        editor.style.display = 'none';
        status.classList.add('hidden');
        const leftText = editor.value || '';
        const send = () => {
            try {
                diffFrame.contentWindow.postMessage({ type: 'json-diff-data', left: leftText, right: '' }, '*');
            } catch (e) {}
        };
        if (diffFrame.contentWindow) {
            send();
        } else {
            diffFrame.addEventListener('load', send, { once: true });
        }
    });
    
});
