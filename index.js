// index.js (使用 extension_settings 存储并包含自动迁移)
import { extension_settings, loadExtensionSettings, getContext } from "../../../extensions.js";
// 尝试导入全局列表，路径可能需要调整！如果导入失败，迁移逻辑需要改用 API 调用
import { saveSettingsDebounced, eventSource, event_types, getRequestHeaders, characters } from "../../../../script.js";

import { groups } from "../../../group-chats.js";

const extensionName = "hideA";
const defaultSettings = {
    // 全局默认设置
    enabled: true,
    // 用于存储每个实体设置的对象
    settings_by_entity: {},
    // 迁移标志
    migration_v1_complete: false,
};

// 缓存上下文
let cachedContext = null;

// DOM元素缓存
const domCache = {
    hideLastNInput: null,
    saveBtn: null,
    currentValueDisplay: null,
    // 初始化缓存
    init() {
        console.debug(`[${extensionName} DEBUG] Initializing DOM cache.`);
        this.hideLastNInput = document.getElementById('hide-last-n');
        this.saveBtn = document.getElementById('hide-save-settings-btn');
        this.currentValueDisplay = document.getElementById('hide-current-value');
        console.debug(`[${extensionName} DEBUG] DOM cache initialized:`, {
            hideLastNInput: !!this.hideLastNInput,
            saveBtn: !!this.saveBtn,
            currentValueDisplay: !!this.currentValueDisplay
        });
    }
};

// 获取优化的上下文
function getContextOptimized() {
    console.debug(`[${extensionName} DEBUG] Entering getContextOptimized.`);
    if (!cachedContext) {
        console.debug(`[${extensionName} DEBUG] Context cache miss. Calling getContext().`);
        cachedContext = getContext();
        console.debug(`[${extensionName} DEBUG] Context fetched:`, cachedContext ? `CharacterId: ${cachedContext.characterId}, GroupId: ${cachedContext.groupId}, Chat Length: ${cachedContext.chat?.length}` : 'null');
    } else {
        console.debug(`[${extensionName} DEBUG] Context cache hit.`);
    }
    return cachedContext;
}

// 辅助函数：获取当前上下文的唯一实体ID
function getCurrentEntityId() {
    const context = getContextOptimized();
    if (!context) return null;

    if (context.groupId) {
        // 使用 group- 前缀和群组ID
        return `group-${context.groupId}`;
    } else if (context.characterId !== undefined && context.characters && context.characters[context.characterId]) {
        const character = context.characters[context.characterId];
        // 使用 character- 前缀和头像文件名
        if (character.avatar) {
            return `character-${character.avatar}`;
        } else {
            console.warn(`[${extensionName}] Cannot determine entityId for character at index ${context.characterId}: Missing avatar filename.`);
            return null; // 无法确定唯一ID
        }
    }
    console.debug(`[${extensionName} DEBUG] Could not determine entityId from context.`);
    return null; // 无法确定实体
}

// 运行数据迁移 (从旧位置到新的全局位置)
function runMigration() {
    const migrationStartTime = performance.now(); // <--- 在函数开始时记录时间戳
    console.log(`[${extensionName}] === Starting Settings Migration Process ===`);
    let migratedCount = 0;
    // 确保容器存在
    extension_settings[extensionName].settings_by_entity = extension_settings[extensionName].settings_by_entity || {};
    const settingsContainer = extension_settings[extensionName].settings_by_entity;
    console.log(`[${extensionName}] Target settings container initialized/found.`);

    // --- 迁移角色数据 ---
    console.log(`[${extensionName}] --- Starting Character Settings Migration ---`);
    // 检查全局 characters 数组是否可用
    if (typeof characters !== 'undefined' && Array.isArray(characters)) {
        console.log(`[${extensionName}] Global 'characters' array found. Number of characters: ${characters.length}.`);
        characters.forEach((character, index) => {
            // ... (之前的角色迁移详细日志和逻辑) ...
            console.log(`[${extensionName}] Processing character #${index}: ${character ? character.name : 'N/A'}`);
            if (!character || !character.data || !character.data.extensions) {
                console.log(`[${extensionName}]   Skip character #${index}: Missing character object, data, or extensions property.`);
                return; // 跳过此角色
            }

            try {
                const oldSettingsPath = 'character.data.extensions.hideHelperSettings';
                // console.log(`[${extensionName}]   Attempting to access old settings at: ${oldSettingsPath}`); // 可以根据需要保留或移除精简日志
                const oldSettings = character.data.extensions.hideHelperSettings;

                if (oldSettings && typeof oldSettings === 'object' && oldSettings !== null) {
                    console.log(`[${extensionName}]   SUCCESS: Found old settings object for character ${character.name}.`); // 精简日志
                    // ... (验证和迁移逻辑) ...
                     const hasHideLastN = typeof oldSettings.hideLastN === 'number';
                    const hasLastProcessedLength = typeof oldSettings.lastProcessedLength === 'number';
                    const isUserConfigured = oldSettings.userConfigured === true;
                    const isValidOldData = hasHideLastN || hasLastProcessedLength || isUserConfigured;

                    // console.log(`[${extensionName}]   Validating old settings data: isValidOldData=${isValidOldData}`); // 可以根据需要保留或移除

                    if (isValidOldData) {
                        const avatarFileName = character.avatar;
                        // console.log(`[${extensionName}]   Character avatar filename: ${avatarFileName || 'MISSING'}`); // 可以根据需要保留或移除

                        if (avatarFileName) {
                            const entityId = `character-${avatarFileName}`;
                            // console.log(`[${extensionName}]   Generated entityId: ${entityId}`); // 可以根据需要保留或移除
                            if (!settingsContainer.hasOwnProperty(entityId)) {
                                // console.log(`[${extensionName}]   ACTION: Migrating settings for entityId '${entityId}'.`); // 可以根据需要保留或移除
                                settingsContainer[entityId] = { ...oldSettings };
                                migratedCount++;
                                // console.log(`[${extensionName}]   Migration successful for entityId '${entityId}'. Count incremented to ${migratedCount}.`); // 可以根据需要保留或移除
                            } else {
                                // console.log(`[${extensionName}]   SKIP MIGRATION: Data already exists for entityId '${entityId}'.`); // 可以根据需要保留或移除
                            }
                        } else {
                             console.warn(`[${extensionName}]   SKIP MIGRATION (Character: ${character.name}): Missing avatar filename.`);
                        }
                    } else {
                         console.warn(`[${extensionName}]   SKIP MIGRATION (Character: ${character.name}): Old settings data is invalid or empty.`);
                    }
                } else {
                     // console.log(`[${extensionName}]   INFO: No old settings object found for this character.`); // 可以根据需要保留或移除
                }
            } catch (charError) {
                 console.error(`[${extensionName}]   ERROR migrating character ${character.name}:`, charError);
            }
            // console.log(`[${extensionName}] Finished processing character #${index}.`); // 可以根据需要保留或移除
        });
         console.log(`[${extensionName}] --- Finished Character Settings Migration ---`);
    } else {
         console.warn(`[${extensionName}] Cannot migrate character settings: Global 'characters' array not available.`);
    }

    // --- 迁移群组数据 ---
    console.log(`[${extensionName}] --- Starting Group Settings Migration ---`);
    // 检查全局 groups 数组是否可用
    if (typeof groups !== 'undefined' && Array.isArray(groups)) {
        console.log(`[${extensionName}] Global 'groups' array found. Number of groups: ${groups.length}.`);
        groups.forEach((group, index) => {
            // ... (之前的群组迁移详细日志和逻辑) ...
             console.log(`[${extensionName}] Processing group #${index}: ${group ? group.name : 'N/A'} (ID: ${group ? group.id : 'N/A'})`);
             if (!group || !group.data) {
                console.log(`[${extensionName}]   Skip group #${index}: Missing group object or data property.`);
                return; // 跳过此群组
            }
            try {
                const oldSettingsPath = 'group.data.hideHelperSettings';
                // console.log(`[${extensionName}]   Attempting to access old settings at: ${oldSettingsPath}`); // 可以根据需要保留或移除
                const oldSettings = group.data.hideHelperSettings;

                 if (oldSettings && typeof oldSettings === 'object' && oldSettings !== null) {
                    console.log(`[${extensionName}]   SUCCESS: Found old settings object for group ${group.name}.`); // 精简日志
                    // ... (验证和迁移逻辑) ...
                    const hasHideLastN = typeof oldSettings.hideLastN === 'number';
                    const hasLastProcessedLength = typeof oldSettings.lastProcessedLength === 'number';
                    const isUserConfigured = oldSettings.userConfigured === true;
                    const isValidOldData = hasHideLastN || hasLastProcessedLength || isUserConfigured;

                    // console.log(`[${extensionName}]   Validating old settings data: isValidOldData=${isValidOldData}`); // 可以根据需要保留或移除

                    if (isValidOldData) {
                        const groupId = group.id;
                        // console.log(`[${extensionName}]   Group ID: ${groupId || 'MISSING'}`); // 可以根据需要保留或移除

                        if (groupId) {
                            const entityId = `group-${groupId}`;
                            // console.log(`[${extensionName}]   Generated entityId: ${entityId}`); // 可以根据需要保留或移除
                            if (!settingsContainer.hasOwnProperty(entityId)) {
                                // console.log(`[${extensionName}]   ACTION: Migrating settings for entityId '${entityId}'.`); // 可以根据需要保留或移除
                                settingsContainer[entityId] = { ...oldSettings };
                                migratedCount++;
                                // console.log(`[${extensionName}]   Migration successful for entityId '${entityId}'. Count incremented to ${migratedCount}.`); // 可以根据需要保留或移除
                            } else {
                                // console.log(`[${extensionName}]   SKIP MIGRATION: Data already exists for entityId '${entityId}'.`); // 可以根据需要保留或移除
                            }
                        } else {
                            console.warn(`[${extensionName}]   SKIP MIGRATION (Group: ${group.name}): Missing group ID.`);
                        }
                    } else {
                        console.warn(`[${extensionName}]   SKIP MIGRATION (Group: ${group.name}): Old settings data is invalid or empty.`);
                    }
                } else {
                    // console.log(`[${extensionName}]   INFO: No old settings object found for this group.`); // 可以根据需要保留或移除
                }
            } catch (groupError) {
                 console.error(`[${extensionName}]   ERROR migrating group ${group.name}:`, groupError);
            }
            // console.log(`[${extensionName}] Finished processing group #${index}.`); // 可以根据需要保留或移除
        });
         console.log(`[${extensionName}] --- Finished Group Settings Migration ---`);
    } else {
        console.warn(`[${extensionName}] Cannot migrate group settings: Global 'groups' array not available.`);
    }

    // --- 完成迁移 ---
     console.log(`[${extensionName}] === Finishing Migration Process ===`);
    if (migratedCount > 0) {
         console.log(`[${extensionName}] Migration finished. Successfully migrated settings for ${migratedCount} entities.`);
    } else {
         console.log(`[${extensionName}] Migration finished. No settings needed migration, no old settings found, or target locations already had data.`);
    }

    // 无论是否迁移了数据，都将标志设置为 true，表示迁移过程已执行
    extension_settings[extensionName].migration_v1_complete = true;
    console.log(`[${extensionName}] Setting migration_v1_complete flag to true.`);
    // 保存包含潜在迁移数据和完成标志的全局设置
    saveSettingsDebounced();
    console.log(`[${extensionName}] Called saveSettingsDebounced() to persist migration flag and any migrated data.`);

    const migrationEndTime = performance.now(); // <--- 在函数结束前记录时间戳
    const migrationDuration = migrationEndTime - migrationStartTime; // <--- 计算时间差
    // <--- 输出总耗时
    console.log(`[${extensionName}] Migration process (iterating ${characters ? characters.length : 0} characters and ${groups ? groups.length : 0} groups) took ${migrationDuration.toFixed(2)} ms.`);

    console.log(`[${extensionName}] === Migration Process Complete ===`);
}

// 初始化扩展设置 (包含迁移检查)
function loadSettings() {
    console.log(`[${extensionName}] Entering loadSettings.`);

    // ****** 临时调试代码：强制检查迁移 ******
    // 目的是确保在本次加载时，即使之前标志为 true，也强制设为 false 以运行迁移检查
    try {
        // 检查 hideA 的设置是否已存在，并且标志位明确为 true
        if (extension_settings[extensionName] && extension_settings[extensionName].migration_v1_complete === true) {
            console.warn(`[${extensionName} DEBUG] TEMPORARY CODE: Forcing migration_v1_complete to false for a one-time check.`);
            extension_settings[extensionName].migration_v1_complete = false;

            // 尝试立即保存这个更改。这很重要！
            // 如果 saveSettingsDebounced 可用，调用它。
            // 注意：防抖函数可能不会立即执行，但这增加了保存的机会。
            if (typeof saveSettingsDebounced === 'function') {
                console.log(`[${extensionName} DEBUG] TEMPORARY CODE: Calling saveSettingsDebounced() after forcing flag.`);
                saveSettingsDebounced();
            } else {
                console.warn(`[${extensionName} DEBUG] TEMPORARY CODE: saveSettingsDebounced function not globally accessible here. Relying on subsequent saves.`);
            }
        } else if (extension_settings[extensionName]) {
             console.log(`[${extensionName} DEBUG] TEMPORARY CODE: Migration flag already false or not set to true. No forcing needed.`);
        } else {
             console.log(`[${extensionName} DEBUG] TEMPORARY CODE: hideA settings object not found yet. Forcing skipped.`);
        }
    } catch (e) {
        console.error(`[${extensionName} DEBUG] TEMPORARY CODE: Error forcing migration flag:`, e);
    }
    // ****** 临时调试代码结束 ******


    extension_settings[extensionName] = extension_settings[extensionName] || {};

    // 使用 Object.assign 合并默认值，确保所有顶级键都存在
    Object.assign(extension_settings[extensionName], {
        enabled: extension_settings[extensionName].hasOwnProperty('enabled') ? extension_settings[extensionName].enabled : defaultSettings.enabled,
        settings_by_entity: extension_settings[extensionName].settings_by_entity || { ...defaultSettings.settings_by_entity },
        // 这里的 migration_v1_complete 读取的是我们刚刚在临时代码中可能修改过的值
        migration_v1_complete: extension_settings[extensionName].migration_v1_complete || defaultSettings.migration_v1_complete,
    });

    // --- 检查并运行迁移 ---
    // 现在这里应该会读取到 false (如果临时代码成功执行并修改了它)
    if (!extension_settings[extensionName].migration_v1_complete) {
        console.log(`[${extensionName}] Migration flag not found or false. Attempting migration...`);
        try {
            // 调用迁移函数
            runMigration(); // 现在应该会执行了
        } catch (error) {
            console.error(`[${extensionName}] Error during migration execution:`, error);
            // 考虑通知用户迁移失败
            // toastr.error('迁移旧设置时发生意外错误，请检查控制台日志。');
        }
    } else {
        // 如果临时代码因为某些原因没能将标志设为 false (例如扩展设置对象还不存在)，
        // 或者迁移真的已经完成且标志又被设回 true，会执行这里
        console.log(`[${extensionName}] Migration flag is true. Skipping migration.`);
    }
    // --------------------------

    console.log(`[${extensionName}] Settings loaded/initialized:`, JSON.parse(JSON.stringify(extension_settings[extensionName]))); // 深拷贝打印避免循环引用
}

// 创建UI面板
function createUI() {
    console.log(`[${extensionName}] Entering createUI.`);
    const settingsHtml = `
    <div id="hide-helper-settings" class="hide-helper-container">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>隐藏助手</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="hide-helper-section">
                    <!-- 开启/关闭选项 -->
                    <div class="hide-helper-toggle-row">
                        <span class="hide-helper-label">插件状态:</span>
                        <select id="hide-helper-toggle">
                            <option value="enabled">开启</option>
                            <option value="disabled">关闭</option>
                        </select>
                    </div>
                    <!-- 可以考虑在这里加一个“清除孤儿设置”或“重置迁移状态”的调试按钮 -->
                </div>
                <hr class="sysHR">
            </div>
        </div>
    </div>`;

    console.log(`[${extensionName}] Appending settings UI to #extensions_settings.`);
    $("#extensions_settings").append(settingsHtml);
    createInputWandButton();
    createPopup();
    setupEventListeners();
    console.log(`[${extensionName}] Scheduling DOM cache initialization.`);
    setTimeout(() => domCache.init(), 100);
    console.log(`[${extensionName}] Exiting createUI.`);
}

// 创建输入区旁的按钮
function createInputWandButton() {
    console.log(`[${extensionName}] Entering createInputWandButton.`);
    const buttonHtml = `
    <div id="hide-helper-wand-button" class="list-group-item flex-container flexGap5" title="隐藏助手">
        <span style="padding-top: 2px;"><i class="fa-solid fa-ghost"></i></span>
        <span>隐藏助手</span>
    </div>`;
    console.log(`[${extensionName}] Appending wand button to #data_bank_wand_container.`);
    $('#data_bank_wand_container').append(buttonHtml);
    console.log(`[${extensionName}] Exiting createInputWandButton.`);
}

// 创建弹出对话框
function createPopup() {
    console.log(`[${extensionName}] Entering createPopup.`);
    const popupHtml = `
    <div id="hide-helper-popup" class="hide-helper-popup">
        <div class="hide-helper-popup-title">隐藏助手设置</div>
        <div class="hide-helper-input-row">
            <button id="hide-save-settings-btn" class="hide-helper-btn">保存设置</button>
            <input type="number" id="hide-last-n" min="0" placeholder="隐藏最近N楼之前的消息">
            <button id="hide-unhide-all-btn" class="hide-helper-btn">取消隐藏</button>
        </div>
        <div class="hide-helper-current">
            <strong>当前隐藏设置:</strong> <span id="hide-current-value">无</span>
        </div>
        <div class="hide-helper-popup-footer">
            <button id="hide-helper-popup-close" class="hide-helper-close-btn">关闭</button>
        </div>
    </div>`;
    console.log(`[${extensionName}] Appending popup HTML to body.`);
    $('body').append(popupHtml);
    console.log(`[${extensionName}] Exiting createPopup.`);
}

// 获取当前角色/群组的隐藏设置 (从全局 extension_settings 读取)
function getCurrentHideSettings() {
    console.debug(`[${extensionName} DEBUG] Entering getCurrentHideSettings.`);
    const entityId = getCurrentEntityId();
    if (!entityId) {
        console.warn(`[${extensionName} DEBUG] getCurrentHideSettings: Could not determine entityId.`);
        return null; // 无法确定实体，返回 null
    }
    // 从全局设置中按 entityId 读取
    const settings = extension_settings[extensionName]?.settings_by_entity?.[entityId] || null;
    console.debug(`[${extensionName} DEBUG] getCurrentHideSettings: Read settings for entityId "${entityId}":`, settings);
    return settings;
}

// 保存当前角色/群组的隐藏设置 (到全局 extension_settings)
function saveCurrentHideSettings(hideLastN) { // 不再需要 async
    console.log(`[${extensionName}] Entering saveCurrentHideSettings with hideLastN: ${hideLastN}`);
    const context = getContextOptimized(); // 仍然需要 context 来获取 entityId 和 chatLength
    if (!context) {
        console.error(`[${extensionName}] Cannot save settings: Context not available.`);
        return false; // 返回 false 表示失败
    }

    const entityId = getCurrentEntityId();
    if (!entityId) {
        console.error(`[${extensionName}] Cannot save settings: Could not determine entityId.`);
        toastr.error('无法保存设置：无法确定当前角色或群组。');
        return false;
    }

    const chatLength = context.chat?.length || 0;
    console.log(`[${extensionName}] saveCurrentHideSettings: Saving for entityId "${entityId}", currentChatLength=${chatLength}`);

    const settingsToSave = {
        hideLastN: hideLastN >= 0 ? hideLastN : 0,
        lastProcessedLength: chatLength,
        userConfigured: true // 标记用户已配置
    };
    console.log(`[${extensionName}] saveCurrentHideSettings: Settings object to save:`, settingsToSave);

    // 确保目标路径存在
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    extension_settings[extensionName].settings_by_entity = extension_settings[extensionName].settings_by_entity || {};

    // 更新内存中的全局设置
    extension_settings[extensionName].settings_by_entity[entityId] = settingsToSave;
    console.log(`[${extensionName}] Updated settings in memory for entityId "${entityId}".`);

    // 调用防抖保存全局设置
    saveSettingsDebounced();
    console.log(`[${extensionName}] saveSettingsDebounced() called to persist changes.`);

    // 返回 true 表示保存指令已成功发出（同步部分完成）
    return true;
}


// 更新当前设置显示
function updateCurrentHideSettingsDisplay() {
    console.debug(`[${extensionName} DEBUG] Entering updateCurrentHideSettingsDisplay.`);
    const currentSettings = getCurrentHideSettings(); // 读取新位置的数据
    console.debug(`[${extensionName} DEBUG] updateCurrentHideSettingsDisplay: Read settings:`, currentSettings);

    if (!domCache.currentValueDisplay) {
        console.debug(`[${extensionName} DEBUG] updateCurrentHideSettingsDisplay: DOM cache for currentValueDisplay not ready, initializing.`);
        domCache.init();
        if (!domCache.currentValueDisplay) {
            console.warn(`[${extensionName} DEBUG] updateCurrentHideSettingsDisplay: currentValueDisplay element still not found after init. Aborting update.`);
            return;
        }
    }

    const displayValue = (currentSettings && currentSettings.hideLastN > 0) ? currentSettings.hideLastN : '无';
    console.debug(`[${extensionName} DEBUG] updateCurrentHideSettingsDisplay: Setting display text to: "${displayValue}"`);
    domCache.currentValueDisplay.textContent = displayValue;

    if (domCache.hideLastNInput) {
        const inputValue = currentSettings?.hideLastN > 0 ? currentSettings.hideLastN : '';
        console.debug(`[${extensionName} DEBUG] updateCurrentHideSettingsDisplay: Setting input value to: "${inputValue}"`);
        domCache.hideLastNInput.value = inputValue;
    } else {
        console.debug(`[${extensionName} DEBUG] updateCurrentHideSettingsDisplay: hideLastNInput element not in cache.`);
    }
    console.debug(`[${extensionName} DEBUG] Exiting updateCurrentHideSettingsDisplay.`);
}

// 防抖函数 (保持不变)
function debounce(fn, delay) {
    let timer;
    return function(...args) {
        console.debug(`[${extensionName} DEBUG] Debounce: Clearing timer for ${fn.name}.`);
        clearTimeout(timer);
        console.debug(`[${extensionName} DEBUG] Debounce: Setting timer for ${fn.name} with delay ${delay}ms.`);
        timer = setTimeout(() => {
            console.debug(`[${extensionName} DEBUG] Debounce: Executing debounced function ${fn.name}.`);
            fn.apply(this, args);
        }, delay);
    };
}

// 防抖版本的全量检查 (保持不变)
const runFullHideCheckDebounced = debounce(runFullHideCheck, 200);

// 检查是否应该执行隐藏/取消隐藏操作
function shouldProcessHiding() {
    console.debug(`[${extensionName} DEBUG] Entering shouldProcessHiding.`);
    // 检查插件是否全局启用
    if (!extension_settings[extensionName]?.enabled) {
        console.debug(`[${extensionName} DEBUG] shouldProcessHiding: Plugin is disabled globally. Returning false.`);
        return false;
    }

    // 检查当前实体是否有设置，并且是用户配置过的
    const settings = getCurrentHideSettings(); // 读取新位置
    console.debug(`[${extensionName} DEBUG] shouldProcessHiding: Read settings for current entity:`, settings);
    if (!settings || settings.userConfigured !== true) {
        console.debug(`[${extensionName} DEBUG] shouldProcessHiding: No user-configured settings found for this entity or settings object missing. Returning false.`);
        return false;
    }
    console.debug(`[${extensionName} DEBUG] shouldProcessHiding: Plugin enabled and user configured settings found. Returning true.`);
    return true;
}

// 增量隐藏检查
async function runIncrementalHideCheck() { // 保持 async 可能更好，以防未来需要 await 操作
    console.debug(`[${extensionName} DEBUG] Entering runIncrementalHideCheck.`);
    if (!shouldProcessHiding()) {
        console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: shouldProcessHiding returned false. Skipping.`);
        return;
    }

    const startTime = performance.now();
    const context = getContextOptimized();
    if (!context || !context.chat) {
        console.warn(`[${extensionName} DEBUG] runIncrementalHideCheck: Aborted. Context or chat data not available.`);
        return;
    }

    const chat = context.chat;
    const currentChatLength = chat.length;
    // 提供默认值，以防 getCurrentHideSettings 返回 null
    const settings = getCurrentHideSettings() || { hideLastN: 0, lastProcessedLength: 0, userConfigured: false };
    const { hideLastN, lastProcessedLength = 0 } = settings; // 解构
    console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: currentChatLength=${currentChatLength}, hideLastN=${hideLastN}, lastProcessedLength=${lastProcessedLength}`);

    // --- 前置条件检查 ---
    if (currentChatLength === 0 || hideLastN <= 0) {
        console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Condition met (currentChatLength === 0 || hideLastN <= 0). Checking if length needs saving.`);
        // 只有当用户配置过且长度 *实际发生变化* 时才更新长度
        if (currentChatLength !== lastProcessedLength && settings.userConfigured) {
            console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Length changed (${lastProcessedLength} -> ${currentChatLength}) with hideLastN <= 0. Saving settings.`);
            saveCurrentHideSettings(hideLastN); // 调用修改后的保存函数
        } else {
             console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Length did not change or not user configured. Skipping save.`);
        }
        console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Skipping main logic due to condition.`);
        return;
    }

    if (currentChatLength <= lastProcessedLength) {
        console.warn(`[${extensionName} DEBUG] runIncrementalHideCheck: Skipped. Chat length did not increase or decreased (${lastProcessedLength} -> ${currentChatLength}). Possibly a delete or unexpected state.`);
         // 如果长度减少了，也需要更新 lastProcessedLength
         if (currentChatLength < lastProcessedLength && settings.userConfigured) {
            console.warn(`[${extensionName} DEBUG] runIncrementalHideCheck: Chat length decreased. Saving settings with new length.`);
            saveCurrentHideSettings(hideLastN); // 保存当前hideLastN和新的chatLength
         }
        return;
    }

    // --- 计算范围 ---
    const targetVisibleStart = Math.max(0, currentChatLength - hideLastN);
    const previousVisibleStart = lastProcessedLength > 0 ? Math.max(0, lastProcessedLength - hideLastN) : 0;
    console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Calculated visible range: targetVisibleStart=${targetVisibleStart}, previousVisibleStart=${previousVisibleStart}`);

    // --- 隐藏逻辑 ---
    if (targetVisibleStart > previousVisibleStart) {
        const toHideIncrementally = [];
        const startIndex = previousVisibleStart;
        const endIndex = targetVisibleStart;
        console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Need to check messages in range [${startIndex}, ${endIndex}).`);

        for (let i = startIndex; i < endIndex; i++) {
            if (chat[i] && chat[i].is_system !== true) { // 检查是否需要隐藏
                toHideIncrementally.push(i);
                 console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Adding message ${i} to incremental hide list.`);
            } else {
                 console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Skipping message ${i} (already system or missing).`);
            }
        }

        if (toHideIncrementally.length > 0) {
            console.log(`[${extensionName}] Incrementally hiding messages: Indices [${toHideIncrementally.join(', ')}]`);
            console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Updating chat array data...`);
            toHideIncrementally.forEach(idx => { if (chat[idx]) chat[idx].is_system = true; });
            console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Chat array data updated.`);

            try {
                console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Updating DOM elements...`);
                const hideSelector = toHideIncrementally.map(id => `.mes[mesid="${id}"]`).join(',');
                if (hideSelector) {
                    console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Applying selector: ${hideSelector}`);
                    $(hideSelector).attr('is_system', 'true');
                    console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: DOM update command issued.`);
                } else {
                    console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: No DOM elements to update.`);
                }
            } catch (error) {
                console.error(`[${extensionName}] Error updating DOM incrementally:`, error);
            }

            console.log(`[${extensionName}] runIncrementalHideCheck: Saving settings after incremental hide.`);
            saveCurrentHideSettings(hideLastN); // 保存更新后的 lastProcessedLength

        } else {
             console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: No messages needed hiding in the new range [${startIndex}, ${endIndex}).`);
             if (settings.lastProcessedLength !== currentChatLength && settings.userConfigured) {
                 console.log(`[${extensionName}] runIncrementalHideCheck: Length changed but no messages hidden. Saving settings.`);
                 saveCurrentHideSettings(hideLastN);
             } else {
                  console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Length did not change or not user configured. Skipping save.`);
             }
        }
    } else {
        console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Visible start did not advance or range invalid (targetVisibleStart <= previousVisibleStart).`);
         if (settings.lastProcessedLength !== currentChatLength && settings.userConfigured) {
             console.log(`[${extensionName}] runIncrementalHideCheck: Length changed but visible start didn't advance. Saving settings.`);
             saveCurrentHideSettings(hideLastN);
         } else {
              console.debug(`[${extensionName} DEBUG] runIncrementalHideCheck: Length did not change or not user configured. Skipping save.`);
         }
    }

    console.debug(`[${extensionName} DEBUG] Incremental check completed in ${performance.now() - startTime}ms`);
}

// 全量隐藏检查
async function runFullHideCheck() { // 保持 async
    console.log(`[${extensionName}] Entering runFullHideCheck.`);
    if (!shouldProcessHiding()) {
        console.log(`[${extensionName}] runFullHideCheck: shouldProcessHiding returned false. Skipping.`);
        return;
    }

    const startTime = performance.now();
    const context = getContextOptimized();
    if (!context || !context.chat) {
        console.warn(`[${extensionName}] runFullHideCheck: Aborted. Context or chat data not available.`);
        return;
    }
    const chat = context.chat;
    const currentChatLength = chat.length;
    console.log(`[${extensionName}] runFullHideCheck: Context OK. Chat length: ${currentChatLength}`);

    const settings = getCurrentHideSettings() || { hideLastN: 0, lastProcessedLength: 0, userConfigured: false };
    const { hideLastN } = settings;
    console.log(`[${extensionName}] runFullHideCheck: Loaded settings for current entity: hideLastN=${hideLastN}, userConfigured=${settings.userConfigured}`);

    // 计算可见边界
    const visibleStart = hideLastN <= 0
        ? 0
        : (hideLastN >= currentChatLength
            ? 0
            : Math.max(0, currentChatLength - hideLastN));
    console.log(`[${extensionName}] runFullHideCheck: Calculated visibleStart index: ${visibleStart}`);

    // 差异计算和数据更新
    const toHide = [];
    const toShow = [];
    let changed = false;
    console.log(`[${extensionName}] runFullHideCheck: Starting diff calculation...`);
    for (let i = 0; i < currentChatLength; i++) {
        const msg = chat[i];
        if (!msg) {
            console.warn(`[${extensionName} DEBUG] runFullHideCheck: Skipping empty message slot at index ${i}.`);
            continue;
        }
        const isCurrentlyHidden = msg.is_system === true;
        const shouldBeHidden = i < visibleStart;

        if (shouldBeHidden && !isCurrentlyHidden) {
            console.debug(`[${extensionName} DEBUG] runFullHideCheck: Index ${i} should be hidden but isn't. Marking to hide.`);
            msg.is_system = true;
            toHide.push(i);
            changed = true;
        } else if (!shouldBeHidden && isCurrentlyHidden) {
            console.debug(`[${extensionName} DEBUG] runFullHideCheck: Index ${i} should be shown but is hidden. Marking to show.`);
            msg.is_system = false;
            toShow.push(i);
            changed = true;
        }
    }
    console.log(`[${extensionName}] runFullHideCheck: Diff calculation done. Changes needed: ${changed}. To hide: ${toHide.length}, To show: ${toShow.length}.`);

    // DOM 更新
    if (changed) {
        try {
            console.log(`[${extensionName}] runFullHideCheck: Applying DOM updates...`);
            if (toHide.length > 0) {
                const hideSelector = toHide.map(id => `.mes[mesid="${id}"]`).join(',');
                if (hideSelector) {
                    console.debug(`[${extensionName} DEBUG] runFullHideCheck: Hiding DOM elements with selector: ${hideSelector}`);
                    $(hideSelector).attr('is_system', 'true');
                }
            }
            if (toShow.length > 0) {
                const showSelector = toShow.map(id => `.mes[mesid="${id}"]`).join(',');
                if (showSelector) {
                    console.debug(`[${extensionName} DEBUG] runFullHideCheck: Showing DOM elements with selector: ${showSelector}`);
                    $(showSelector).attr('is_system', 'false');
                }
            }
             console.log(`[${extensionName}] runFullHideCheck: DOM updates applied.`);
        } catch (error) {
            console.error(`[${extensionName}] Error updating DOM in full check:`, error);
        }
    } else {
         console.log(`[${extensionName}] runFullHideCheck: No changes needed in chat data or DOM based on current settings.`);
    }

    // 更新处理长度并保存设置
    console.log(`[${extensionName}] runFullHideCheck: Checking if settings need saving. lastProcessedLength=${settings.lastProcessedLength}, currentChatLength=${currentChatLength}, userConfigured=${settings.userConfigured}`);
    // 只有在用户已配置过，并且长度发生变化时才保存
    if (settings.userConfigured && settings.lastProcessedLength !== currentChatLength) {
        console.log(`[${extensionName}] runFullHideCheck: Length changed (${settings.lastProcessedLength} -> ${currentChatLength}) and user configured. Saving settings.`);
        saveCurrentHideSettings(hideLastN); // 调用修改后的保存函数
    } else {
         console.log(`[${extensionName}] runFullHideCheck: Settings save not required (length unchanged or not user configured).`);
    }
    console.log(`[${extensionName}] Full check completed in ${performance.now() - startTime}ms`);
}

// 全部取消隐藏功能
async function unhideAllMessages() { // 保持 async
    const startTime = performance.now();
    console.log(`[${extensionName}] Entering unhideAllMessages.`);
    const context = getContextOptimized();
    // 尝试重置设置，即使聊天不可用
    const entityId = getCurrentEntityId(); // 需要 entityId 来重置设置

    if (!context || !context.chat) {
         console.warn(`[${extensionName}] Unhide all: Chat data not available.`);
         if (entityId) {
             console.log(`[${extensionName}] Unhide all: Attempting to reset hide settings to 0 for entity ${entityId} even though chat is unavailable.`);
             saveCurrentHideSettings(0); // 重置为 0
             updateCurrentHideSettingsDisplay(); // 更新UI显示
         } else {
             console.error(`[${extensionName}] Unhide all aborted: Cannot determine entityId to reset settings.`);
             toastr.error('无法取消隐藏：无法确定当前目标。');
         }
         return;
    }

    const chat = context.chat;
    const chatLength = chat.length;
    console.log(`[${extensionName}] Unhide all: Chat length is ${chatLength}.`);

    // 找出所有当前隐藏的消息
    const toShow = [];
    console.log(`[${extensionName}] Unhide all: Scanning chat for hidden messages...`);
    for (let i = 0; i < chatLength; i++) {
        if (chat[i] && chat[i].is_system === true) {
            console.debug(`[${extensionName} DEBUG] Unhide all: Found hidden message at index ${i}. Marking to show.`);
            toShow.push(i);
        }
    }
    console.log(`[${extensionName}] Unhide all: Found ${toShow.length} messages to unhide.`);

    // 批量更新数据和DOM
    if (toShow.length > 0) {
        console.log(`[${extensionName}] Unhide all: Updating chat array data...`);
        toShow.forEach(idx => { if (chat[idx]) chat[idx].is_system = false; });
        console.log(`[${extensionName}] Unhide all: Chat data updated.`);
        try {
            console.log(`[${extensionName}] Unhide all: Updating DOM...`);
            const showSelector = toShow.map(id => `.mes[mesid="${id}"]`).join(',');
            if (showSelector) {
                 console.debug(`[${extensionName} DEBUG] Unhide all: Applying selector: ${showSelector}`);
                 $(showSelector).attr('is_system', 'false');
                 console.log(`[${extensionName}] Unhide all: DOM updated.`);
            }
        } catch (error) {
            console.error(`[${extensionName}] Error updating DOM when unhiding all:`, error);
        }
    } else {
        console.log(`[${extensionName}] Unhide all: No hidden messages found to change.`);
    }

    // 重置隐藏设置为0，并保存
    console.log(`[${extensionName}] Unhide all: Saving hide setting as 0.`);
    const success = saveCurrentHideSettings(0); // 调用修改后的保存函数
    if (success) { // saveCurrentHideSettings 现在同步返回 true/false
        console.log(`[${extensionName}] Unhide all: Hide setting successfully reset to 0.`);
        updateCurrentHideSettingsDisplay(); // 只有保存指令成功发出才更新显示
    } else {
        console.error(`[${extensionName}] Unhide all: Failed to issue command to reset hide setting to 0.`);
        // toastr.error 由 saveCurrentHideSettings 内部处理
    }
     console.log(`[${extensionName}] Unhide all completed in ${performance.now() - startTime}ms`);
}

// 设置UI元素的事件监听器
function setupEventListeners() {
    console.log(`[${extensionName}] Entering setupEventListeners.`);

    // 弹出对话框按钮事件
    console.log(`[${extensionName}] Setting up click listener for #hide-helper-wand-button.`);
    $('#hide-helper-wand-button').on('click', function() {
        console.log(`[${extensionName}] Wand button clicked.`);
        if (!extension_settings[extensionName]?.enabled) {
            console.warn(`[${extensionName}] Wand button clicked but extension is disabled.`);
            toastr.warning('隐藏助手当前已禁用，请在扩展设置中启用。');
            return;
        }
        console.log(`[${extensionName}] Wand button: Extension enabled. Updating display before showing popup.`);
        updateCurrentHideSettingsDisplay(); // 打开前更新显示

        const $popup = $('#hide-helper-popup');
        console.log(`[${extensionName}] Wand button: Displaying popup.`);
        $popup.css({
            'display': 'block', 'visibility': 'hidden', 'position': 'fixed',
            'left': '50%', 'transform': 'translateX(-50%)'
        });
        setTimeout(() => {
            console.debug(`[${extensionName} DEBUG] Wand button: Calculating popup position.`);
            const popupHeight = $popup.outerHeight();
            const windowHeight = $(window).height();
            const topPosition = Math.max(10, Math.min((windowHeight - popupHeight) / 2, windowHeight - popupHeight - 50));
             console.debug(`[${extensionName} DEBUG] Wand button: Calculated topPosition: ${topPosition}px. Making popup visible.`);
            $popup.css({ 'top': topPosition + 'px', 'visibility': 'visible' });
        }, 0);
    });

    // 弹出框关闭按钮事件
    console.log(`[${extensionName}] Setting up click listener for #hide-helper-popup-close.`);
    $('#hide-helper-popup-close').on('click', function() {
        console.log(`[${extensionName}] Popup close button clicked.`);
        $('#hide-helper-popup').hide();
    });

    // 全局启用/禁用切换事件
    console.log(`[${extensionName}] Setting up change listener for #hide-helper-toggle.`);
    $('#hide-helper-toggle').on('change', function() {
        const isEnabled = $(this).val() === 'enabled';
        console.log(`[${extensionName}] Global toggle changed. New state: ${isEnabled ? 'enabled' : 'disabled'}`);
        if (extension_settings[extensionName]) {
            extension_settings[extensionName].enabled = isEnabled;
            console.log(`[${extensionName}] Saving global settings due to toggle change.`);
            saveSettingsDebounced(); // 保存全局设置
        }

        if (isEnabled) {
            console.log(`[${extensionName}] Extension enabled via toggle. Running full check.`);
            toastr.success('隐藏助手已启用');
            runFullHideCheckDebounced(); // 启用时检查一次
        } else {
            console.log(`[${extensionName}] Extension disabled via toggle.`);
            toastr.warning('隐藏助手已禁用');
            // 禁用时不自动取消隐藏，保留状态
        }
    });

    // 输入框输入事件
    const hideLastNInput = document.getElementById('hide-last-n');
    if (hideLastNInput) {
        console.log(`[${extensionName}] Setting up input listener for #hide-last-n.`);
        hideLastNInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
             console.debug(`[${extensionName} DEBUG] Input field changed. Raw value: "${e.target.value}", Parsed value: ${value}`);
            if (isNaN(value) || value < 0) {
                 console.debug(`[${extensionName} DEBUG] Input invalid or negative. Clearing input field.`);
                 e.target.value = '';
            } else {
                 console.debug(`[${extensionName} DEBUG] Input valid. Keeping value: ${value}`);
                 e.target.value = value;
            }
        });
    } else {
        console.warn(`[${extensionName}] Could not find #hide-last-n input element to attach listener.`);
    }

    // 保存设置按钮事件
    console.log(`[${extensionName}] Setting up click listener for #hide-save-settings-btn.`);
    $('#hide-save-settings-btn').on('click', function() { // 不再需要 async
        console.log(`[${extensionName}] Save settings button clicked.`);
        const value = parseInt(hideLastNInput.value);
        const valueToSave = isNaN(value) || value < 0 ? 0 : value;
         console.log(`[${extensionName}] Save button: Parsed input value: ${value}. Value to save: ${valueToSave}`);

        const currentSettings = getCurrentHideSettings();
        const currentValue = currentSettings?.hideLastN || 0;
         console.log(`[${extensionName}] Save button: Current saved value: ${currentValue}`);

        if (valueToSave !== currentValue) {
            console.log(`[${extensionName}] Save button: Value changed from ${currentValue} to ${valueToSave}. Proceeding with save.`);
            const $btn = $(this);
            const originalText = $btn.text();
            $btn.text('保存中...').prop('disabled', true); // 临时禁用按钮

            console.log(`[${extensionName}] Save button: Calling saveCurrentHideSettings(${valueToSave}).`);
            const success = saveCurrentHideSettings(valueToSave); // 同步调用
             console.log(`[${extensionName}] Save button: saveCurrentHideSettings returned: ${success}`);

            if (success) {
                console.log(`[${extensionName}] Save button: Save instruction issued successfully. Running full check and updating display.`);
                runFullHideCheck(); // 直接运行检查
                updateCurrentHideSettingsDisplay();
                toastr.success('隐藏设置已保存');
            } else {
                 console.error(`[${extensionName}] Save button: Save instruction failed.`);
                 // 错误消息由 saveCurrentHideSettings 内部处理
            }

            console.log(`[${extensionName}] Save button: Restoring button state.`);
            $btn.text(originalText).prop('disabled', false); // 恢复按钮
        } else {
            console.log(`[${extensionName}] Save button: Value (${valueToSave}) hasn't changed from current (${currentValue}). Skipping save.`);
            toastr.info('设置未更改');
        }
    });

    // 全部取消隐藏按钮事件
    console.log(`[${extensionName}] Setting up click listener for #hide-unhide-all-btn.`);
    $('#hide-unhide-all-btn').on('click', async function() { // 保持 async
        console.log(`[${extensionName}] Unhide all button clicked.`);
        await unhideAllMessages();
        console.log(`[${extensionName}] Unhide all process finished.`);
    });

    // --- 核心事件监听 ---

    // 聊天切换事件
    console.log(`[${extensionName}] Setting up listener for event: ${event_types.CHAT_CHANGED}`);
    eventSource.on(event_types.CHAT_CHANGED, (data) => {
        console.log(`[${extensionName}] Event received: ${event_types.CHAT_CHANGED}`, data);
        console.log(`[${extensionName}] CHAT_CHANGED: Clearing context cache.`);
        cachedContext = null; // 清除上下文缓存

        const newContext = getContextOptimized(); // 获取新上下文用于日志
        const newCharId = newContext?.characterId;
        const newGroupId = newContext?.groupId;
        const newEntityId = getCurrentEntityId(); // 获取新实体ID
        console.log(`[${extensionName}] CHAT_CHANGED: New context info - CharacterId: ${newCharId}, GroupId: ${newGroupId}, EntityId: ${newEntityId}`);

        console.log(`[${extensionName}] CHAT_CHANGED: Updating global toggle display.`);
        $('#hide-helper-toggle').val(extension_settings[extensionName]?.enabled ? 'enabled' : 'disabled');

        console.log(`[${extensionName}] CHAT_CHANGED: Updating current hide settings display for new chat/entity.`);
        updateCurrentHideSettingsDisplay(); // 更新显示

        if (extension_settings[extensionName]?.enabled) {
            console.log(`[${extensionName}] CHAT_CHANGED: Extension is enabled. Scheduling debounced full hide check.`);
            runFullHideCheckDebounced(); // 运行检查
        } else {
            console.log(`[${extensionName}] CHAT_CHANGED: Extension is disabled. Skipping full hide check.`);
        }
    });

    // 新消息事件
    const handleNewMessage = (eventType) => {
        console.debug(`[${extensionName} DEBUG] Event received: ${eventType}`);
        if (extension_settings[extensionName]?.enabled) {
            console.debug(`[${extensionName} DEBUG] ${eventType}: Extension enabled. Scheduling incremental hide check.`);
            setTimeout(() => runIncrementalHideCheck(), 100); // 延迟执行增量检查
        } else {
             console.debug(`[${extensionName} DEBUG] ${eventType}: Extension disabled. Skipping incremental check.`);
        }
    };
    console.log(`[${extensionName}] Setting up listener for event: ${event_types.MESSAGE_RECEIVED}`);
    eventSource.on(event_types.MESSAGE_RECEIVED, () => handleNewMessage(event_types.MESSAGE_RECEIVED));
    console.log(`[${extensionName}] Setting up listener for event: ${event_types.MESSAGE_SENT}`);
    eventSource.on(event_types.MESSAGE_SENT, () => handleNewMessage(event_types.MESSAGE_SENT));

    // 消息删除事件
    console.log(`[${extensionName}] Setting up listener for event: ${event_types.MESSAGE_DELETED}`);
    eventSource.on(event_types.MESSAGE_DELETED, () => {
        console.log(`[${extensionName}] Event received: ${event_types.MESSAGE_DELETED}`);
        if (extension_settings[extensionName]?.enabled) {
            console.log(`[${extensionName}] ${event_types.MESSAGE_DELETED}: Extension enabled. Scheduling debounced full hide check.`);
            runFullHideCheckDebounced(); // 删除后运行全量检查
        } else {
             console.log(`[${extensionName}] ${event_types.MESSAGE_DELETED}: Extension disabled. Skipping full check.`);
        }
    });

    // 生成结束事件 (代替 STREAM_END)
    const streamEndEvent = event_types.GENERATION_ENDED;
    console.log(`[${extensionName}] Setting up listener for event: ${streamEndEvent} (generation ended)`);
    eventSource.on(streamEndEvent, () => {
         console.log(`[${extensionName}] Event received: ${streamEndEvent}`);
         if (extension_settings[extensionName]?.enabled) {
            console.log(`[${extensionName}] ${streamEndEvent}: Extension enabled. Scheduling debounced full hide check after generation end.`);
            runFullHideCheckDebounced(); // 生成结束后全量检查
        } else {
             console.log(`[${extensionName}] ${streamEndEvent}: Extension disabled. Skipping full check.`);
        }
    });

    console.log(`[${extensionName}] Exiting setupEventListeners.`);
}

// 初始化扩展
jQuery(async () => {
    console.log(`[${extensionName}] Initializing extension (jQuery ready)...`);

    // 延迟执行以确保 SillyTavern 核心（包括 settings 和可能需要的 characters/groups）已加载
    const initialDelay = 2000; // 增加延迟到 2 秒，给迁移所需数据加载留出时间
    console.log(`[${extensionName}] Scheduling initial setup tasks with delay: ${initialDelay}ms`);
    setTimeout(() => {
        console.log(`[${extensionName}] Running initial setup tasks after delay.`);

        try {
            window.debug_st_settings = extension_settings;
            console.log('[hideA DEBUG] Exposed extension_settings to window.debug_st_settings for debugging.');
            // (可选) 打印一下当前 hideA 的设置状态，方便确认
            if (window.debug_st_settings && window.debug_st_settings[extensionName]) {
                 console.log('[hideA DEBUG] Current hideA settings state in debug object:', JSON.parse(JSON.stringify(window.debug_st_settings[extensionName])));
            } else {
                 console.log('[hideA DEBUG] hideA settings not yet found in debug_st_settings.');
            }
        } catch (e) {
            console.error('[hideA DEBUG] Error occurred while exposing extension_settings:', e);
        }

        // 1. 加载设置并触发迁移检查
        loadSettings();

        // 2. 创建 UI (现在依赖于 loadSettings 完成初始化和迁移检查)
        createUI();

        // 3. 更新初始 UI 状态
        console.log(`[${extensionName}] Initial setup: Setting global toggle display.`);
        $('#hide-helper-toggle').val(extension_settings[extensionName]?.enabled ? 'enabled' : 'disabled');

        console.log(`[${extensionName}] Initial setup: Updating current hide settings display.`);
        updateCurrentHideSettingsDisplay();

        // 4. 初始加载时执行全量检查 (如果插件启用且当前实体有用户配置)
        if (extension_settings[extensionName]?.enabled) {
            console.log(`[${extensionName}] Initial setup: Extension is enabled. Checking if initial full check is needed.`);
            const initialSettings = getCurrentHideSettings();
             console.log(`[${extensionName}] Initial setup: Read initial settings for current entity:`, initialSettings);
            if(initialSettings?.userConfigured === true) {
                console.log(`[${extensionName}] Initial setup: User configured settings found for the current entity. Running initial full hide check.`);
                runFullHideCheck(); // 直接运行，非防抖
            } else {
                console.log(`[${extensionName}] Initial setup: No user configured settings found for the current entity. Skipping initial full check.`);
            }
        } else {
             console.log(`[${extensionName}] Initial setup: Extension is disabled. Skipping initial full check.`);
        }
        console.log(`[${extensionName}] Initial setup tasks completed.`);
    }, initialDelay);
});
