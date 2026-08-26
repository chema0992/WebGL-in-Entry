// ==UserScript==
// @name         엔트리 확장 Core (EAPI)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  엔트리 로딩 대기, EAPI 모듈 실행 및 카테고리 폭/스타일 깨짐 방지 통합 렌더링
// @match        *://playentry.org/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    window.EAPI = window.EAPI || {
        modules: [],
        categories: [],
        render: null
    };

    // 엔트리 기본 카테고리 목록
    const baseCategories = [
        { category: 'start', visible: true }, { category: 'flow', visible: true },
        { category: 'moving', visible: true }, { category: 'looks', visible: true },
        { category: 'brush', visible: true }, { category: 'text', visible: true },
        { category: 'sound', visible: true }, { category: 'judgement', visible: true },
        { category: 'calc', visible: true }, { category: 'variable', visible: true },
        { category: 'func', visible: true }, { category: 'analysis', visible: true },
        { category: 'ai_utilize', visible: true }, { category: 'expansion', visible: true },
        { category: 'arduino', visible: false }
    ];

    const timer = setInterval(() => {
        let targetWindow = window;
        let isIframe = false;

        const iframe = document.querySelector('iframe.project_iframe') || document.querySelector('iframe');
        if (iframe && iframe.contentWindow && iframe.contentWindow.Entry) {
            targetWindow = iframe.contentWindow;
            isIframe = true;
        }

        const Entry = targetWindow.Entry;
        const EntryStatic = targetWindow.EntryStatic;

        if (!Entry || !Entry.block) return;
        if (!isIframe && (!Entry.playground || !Entry.playground.mainWorkspace || !Entry.playground.blockMenu)) return;

        clearInterval(timer);
        console.log('[EAPI Core] 엔트리 감지 완료. 모듈 주입을 시작합니다.');

        const $ = targetWindow.$;

        // 통합 렌더링 함수
        const renderEAPI = () => {
            // 1. 미실행된 모듈 init() 호출
            if (window.EAPI && window.EAPI.modules) {
                window.EAPI.modules.forEach(module => {
                    if (typeof module.init === 'function' && !module.injected) {
                        try {
                            module.init(targetWindow, Entry, EntryStatic, $);
                            module.injected = true;
                        } catch (e) {
                            console.error(`[EAPI Core] 모듈 (${module.name || '알 수 없음'}) 초기화 중 오류 발생:`, e);
                        }
                    }
                });
            }

            // 2. EAPI 카테고리 목록 중복 제거 (Key 기준 고유화)
            const uniqueCustomCategories = [];
            const seenCategoryKeys = new Set();

            (window.EAPI.categories || []).forEach(cat => {
                if (!seenCategoryKeys.has(cat.category)) {
                    seenCategoryKeys.add(cat.category);
                    uniqueCustomCategories.push(cat);
                }
            });
            window.EAPI.categories = uniqueCustomCategories;

            // 3. 카테고리 뷰 재생성
            if (Entry.playground && Entry.playground.mainWorkspace && Entry.playground.blockMenu) {
                const finalCategories = [...baseCategories];

                uniqueCustomCategories.forEach(cat => {
                    if (!finalCategories.some(c => c.category === cat.category)) {
                        finalCategories.push(cat);
                    }
                });

                // 블록 메뉴 전체 카테고리 뷰 재구성
                Entry.playground.blockMenu._generateCategoryView(finalCategories);

                // CSS 찌그러짐 원인 제거: 엔트리 기본 클래스 정제
                if ($) {
                    $('.entryCategoryElementWorkspace')
                        .not('#entryCategorytext')
                        .attr('class', 'entryCategoryElementWorkspace');
                }

                Entry.playground.blockMenu._categoryData = EntryStatic.getAllBlocks();

                // 확장 카테고리들의 텍스트 및 개별 배경색 보정
                uniqueCustomCategories.forEach(cat => {
                    Entry.playground.blockMenu._generateCategoryCode(cat.category);
                    if ($) {
                        const $elem = $(`#entryCategory${cat.category}`);
                        if ($elem.length) {
                            $elem.text(cat.displayName || cat.category);
                            $elem.css({
                                'background-color': cat.color || '#8E44AD',
                                'color': cat.fontColor || '#ffffff',
                                'width': '65',
                                'box-sizing': 'border-box'
                            });
                        }
                    }
                });
            }
        };

        window.EAPI.render = renderEAPI;
        renderEAPI();
    }, 200);
})();
