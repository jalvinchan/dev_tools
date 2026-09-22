window.registerTool('diff', {
    title: 'Diff',
    template: `
  <div class="diff-container">
    <div class="diff-controls">
      <select id="diff-mode" class="btn">
        <option value="lines">Lines</option>
        <option value="words">Words</option>
        <option value="chars">Chars</option>
      </select>
      <button class="btn" id="diff-compare">Compare</button>
      <button class="btn" id="diff-clear">Clear</button>
      <button class="btn" id="diff-sample">Sample</button>
    </div>
    <div class="diff-inputs">
      <div style="display:flex;flex-direction:column">
        <div class="diff-header">Original Text</div>
        <textarea id="diff-old" class="input" style="border-radius:6px;resize:none" placeholder="Paste original text here..."></textarea>
      </div>
      <div style="display:flex;flex-direction:column">
        <div class="diff-header">Modified Text</div>
        <textarea id="diff-new" class="input" style="border-radius:6px;resize:none" placeholder="Paste modified text here..."></textarea>
      </div>
    </div>
    <div id="diff-output" class="diff-output"></div>
  </div>
    `,
    init: function() {
        const oldInput = document.getElementById('diff-old');
        const newInput = document.getElementById('diff-new');
        const output = document.getElementById('diff-output');
        const modeSelect = document.getElementById('diff-mode');
        const compareBtn = document.getElementById('diff-compare');
        const clearBtn = document.getElementById('diff-clear');
        const sampleBtn = document.getElementById('diff-sample');
        
        const keyOld = 'diff_old_v1';
        const keyNew = 'diff_new_v1';
        const keyMode = 'diff_mode_v1';

        function computeDiff() {
            if (!window.Diff) {
                output.textContent = 'Error: jsdiff library not loaded.';
                return;
            }
            
            const oldText = oldInput.value;
            const newText = newInput.value;
            const mode = modeSelect.value;
            
            let diff;
            if (mode === 'chars') {
                diff = Diff.diffChars(oldText, newText);
            } else if (mode === 'words') {
                diff = Diff.diffWords(oldText, newText);
            } else {
                diff = Diff.diffLines(oldText, newText);
            }
            
            const fragment = document.createDocumentFragment();
            diff.forEach((part) => {
                // green for additions, red for deletions
                // grey for common parts
                const color = part.added ? 'diff-ins' :
                              part.removed ? 'diff-del' : 'diff-common';
                const span = document.createElement('span');
                span.className = color;
                span.textContent = part.value;
                fragment.appendChild(span);
            });
            
            output.innerHTML = '';
            output.appendChild(fragment);
        }

        function save() {
            try {
                localStorage.setItem(keyOld, oldInput.value);
                localStorage.setItem(keyNew, newInput.value);
                localStorage.setItem(keyMode, modeSelect.value);
            } catch (e) {}
        }

        function load() {
            try {
                const oldVal = localStorage.getItem(keyOld);
                if (oldVal) oldInput.value = oldVal;
                
                const newVal = localStorage.getItem(keyNew);
                if (newVal) newInput.value = newVal;
                
                const modeVal = localStorage.getItem(keyMode);
                if (modeVal) modeSelect.value = modeVal;
            } catch (e) {}
        }

        compareBtn.addEventListener('click', () => {
            computeDiff();
            save();
        });

        clearBtn.addEventListener('click', () => {
            oldInput.value = '';
            newInput.value = '';
            output.innerHTML = '';
            save();
        });

        sampleBtn.addEventListener('click', () => {
            oldInput.value = 'The quick brown fox jumps over the lazy dog.\nThis is a sample text.';
            newInput.value = 'The quick red fox jumps over the lazy cat.\nThis is a sample text with changes.';
            computeDiff();
            save();
        });

        // Auto-save on input, but don't auto-compute diff on every keystroke for performance (or maybe debounce?)
        // Let's just save.
        oldInput.addEventListener('input', save);
        newInput.addEventListener('input', save);
        modeSelect.addEventListener('change', () => {
            computeDiff();
            save();
        });

        load();
        // If there is content, compute diff on load
        if (oldInput.value || newInput.value) {
            computeDiff();
        }
    }
});
