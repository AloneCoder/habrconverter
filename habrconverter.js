habrconverter = (function () {

    if (!Array.prototype.last) {
        Array.prototype.last = function () {
            return this[this.length - 1];
        };
    }

    (function (ELEMENT) {
        ELEMENT.matches = ELEMENT.matches || ELEMENT.mozMatchesSelector || ELEMENT.msMatchesSelector || ELEMENT.oMatchesSelector || ELEMENT.webkitMatchesSelector;
        ELEMENT.closest = ELEMENT.closest || function closest(selector) {
            if (!this) return null;
            if (this.matches(selector)) return this;
            if (!this.parentElement) {
                return null
            } else return this.parentElement.closest(selector)
        };
    }(Element.prototype));

    const STYLES = {
            italic: {open: '<i>', close: '</i>'},
            bold: {open: '<strong>', close: '</strong>'},
            underlined: {open: '<u>', close: '</u>'},
            strikeout: {open: '<s>', close: '</s>'},
            sup: {open: '<sup>', close: '</sup>'},
            sub: {open: '<sub>', close: '</sub>'},
            monospace: {open: '<code>', close: '</code>'}
        }, NEW_LINE_AFTER_CLOSE_TAG = {
            table: true,
            td: true,
            ul: true,
            ol: true,
            li: true,
            source: true,
            tr: true,
            h1: true,
            h2: true,
            h3: true,
            h4: true,
            h5: true,
            h6: true,
            img: true
        },
        NEW_LINE_AFTER_OPEN_TAG = {
            table: true, ul: true, ol: true, source: true, tr: true
        },
        NEW_LINE_BEFORE_OPEN_TAG = {
            ul: true, ol: true, img: true
        },
        PRESERVE_TAG_ATTIBUTES = {
            td: ['colspan'],
            tr: ['rowspan'],
            a: ['href'],
            img: ['src', 'align', 'valign']
        };
    let noNlStack = [], globalTagStack = [];

    function convert(content) {

        //fix some invalid styles
        content.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function (h) {
            h.querySelectorAll('*').forEach(function (el) {
                if (el.tagName && /bold|700/.test(el.style.fontWeight)) {
                    el.style.fontWeight = '400';
                }
            });
        });

        content.querySelectorAll('img').forEach(function (i) {
            i.setAttribute('align', 'center');
            i.align = 'center';
        });

        content.querySelectorAll('a').forEach(function (h) {
            h.querySelectorAll('*').forEach(function (el) {
                if (el.tagName && /underline/.test(el.style.textDecoration)) {
                    el.style.textDecoration = 'none';
                }
            });
        });

        let el, parent;
        while ((el = content.querySelector('ol h1, ol h2, ol h3, ol h4, ol h5, ol h6, ul h1, ul h2, ul h3, ul h4, ul h5, ul h6'))) {
            parent = el.closest('ol,ul');
            parent.parentNode.replaceChild(el, parent);
        }

        let result = [];
        const state = {
            styles: {
                italic: false,
                bold: false,
                underlined: false,
                strikeout: false,
                sup: false,
                sub: false,
                monospace: false
            }
        };
        convertElement(content, state, result);
        return result.join('')
            .trim()
            .replace(/[\n\r]{2,}/g, '\n\n')
            .replace(/[\n\r]{2,}(<img)/g, '\n\n$1')
            .replace(/(<img[^>]+>)[\n\r]{2,}/g, '$1\n')
            .replace(/(<\/(h\d|table|ul|ol)>)[\n\r]{2,}/g, '$1\n')
            .replace(/align="middle"/g, 'align="center"')
            ;
    }




    function convertElement(element, state, result) {

        if (element.nodeName === "#comment") {
            return;
        }

        let tagName = element.tagName ? element.tagName.toLowerCase() : undefined, tagStack = [], _tag;
        if (!tagName) {
            result.push(convertText(element.nodeValue || ''));

        } else if (/^(li|ul|ol|table|tr|td|img|a|h\d)$/.test(tagName)) {

            noNlStack.push(true);

            if (!/img/.test(tagName) && tagStack.last() !== tagName) {
                tagStack.push(tagName);
            }

            if (!/img/.test(tagName)){
                globalTagStack.push(tagName);
            }


            let _s = NEW_LINE_BEFORE_OPEN_TAG[tagName] ? '\n' : '';
            _s += '<' + tagName;
            if (PRESERVE_TAG_ATTIBUTES[tagName]) {
                PRESERVE_TAG_ATTIBUTES[tagName].forEach(function (attr) {
                    if (element.hasAttribute(attr)) {
                        _s += ' ' + attr + '="' + element.getAttribute(attr) + '"';
                    }
                })
            }
            _s += '>';
            result.push(_s);
            if (NEW_LINE_AFTER_OPEN_TAG[tagName]) {
                result.push('\n');
            }
            convertElements(element.childNodes, state, result);

            while ((_tag = tagStack.pop())) {
                result.push('</' + _tag.toLowerCase() + '>');
                if (NEW_LINE_AFTER_CLOSE_TAG[_tag.toLowerCase()]) {
                    result.push('\n');
                }
            }
            if (/img/.test(tagName)) {
                result.push('\n\n');
            }

            if (!/img/.test(tagName)){
                globalTagStack.shift();
            }

            noNlStack.shift();

        } else if ('br' === tagName) {
            result.push('\n');
        } else if ('hr' === tagName) {
            result.push('<hr/>\n')
        } else {

            const myStyles = getBasicStyles(element);
            for (let style in state.styles) {
                if (!state.styles[style] && myStyles[style]) {
                    result.push(STYLES[style].open);
                    if (tagStack.last() !== style) {
                        tagStack.push(style);
                    }
                }
            }

            convertElements(element.childNodes, state, result);

            while ((_tag = tagStack.pop())) {
                if (STYLES[_tag]) {
                    result.push(STYLES[_tag].close);
                }
            }
            if ('block' === getComputedStyles(element).display && result.length && !/\n$/.test(result.last())) {
                if (!noNlStack.length) {
                    result.push('\n\n');
                }

            }
        }
    }

    function isCodeBlock(element) {

        if (!element.tagName) {
            return false;
        }

        let result = ('block' === getComputedStyles(element).display);
        if (!result) {
            return false;
        }
        return Array.from(element.querySelectorAll('*')).every(function (el) {
            return getBasicStyles(el)['monospace'];
        });
    }

    function convertText(text) {
        if (text.match(/<[^>]+>/g)) {
            return text;
        }

        return text
            .replace(/“|”/g, '"')
            .replace(' - ', ' — ')
            .replace(/["]{2,}/g, '«»')
            .replace(/((?![\wа-я])("))|([^\s]["]+(?![\w]))/gi, function (m, m1, m2, m3) {
                if (m1) return m1.replace('"', "«");
                else return m3.replace('"', "»");
            });
        /*
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')*/
    }


    function getComputedStyles(element) {
        return element.currentStyle || document.defaultView.getComputedStyle(element, null)
    }

    function getBasicStyles(element) {
        const style = element.style;
        return {
            italic: /italic/.test(style.fontStyle),
            bold: /bold|700/.test(style.fontWeight),
            underlined: /underline/.test(style.textDecoration),
            strikeout: /line-through/.test(style.textDecoration),
            sup: /super/.test(style.verticalAlign),
            sub: /sub/.test(style.verticalAlign),
            monospace: /Courier/.test(style.fontFamily)
        }
    }

    function convertElements(elements, state, result) {
        let el, to = false;
        for (let i = 0; i < elements.length; i++) {
            el = elements[i];
            if ((to && getBasicStyles(el)['monospace'])) {

                result.push(el.textContent);

            } else if (isCodeBlock(el) || (to && el.tagName && el.tagName.toLowerCase() === 'br') || (to && getBasicStyles(el)['monospace'])) {
                if (!to) {
                    pushCodeElement(result);
                    to = true;
                }

                if (el.tagName.toLowerCase() === '<br>') {
                    result.push('\n');
                } else {
                    result.push(el.textContent + '\n');
                }


            } else {
                if (to) {
                    while(result.last().match(/^\s+$/)){
                        result.pop();
                    }
                    pushCodeElement(result, true);
                    to = false;
                }
                convertElement(el, state, result);
            }

        }

        if (to) {
            pushCodeElement(result, true);
        }
    }

    function pushCodeElement(result, end){
        end = end || false;
        let str = '<' + (end?'/':'');
        if (globalTagStack.indexOf('table') > -1){
            str += 'code>';
        } else {
            str += 'source>\n';
        }

        result.push(str);
    }

    return {
        convert: convert
    }
})();
