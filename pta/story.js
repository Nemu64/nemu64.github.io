// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Really restart? You will lose all progress up to this point.')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.id = '1e3f553e06';
squiffy.story.sections = {
	'_default': {
		'text': "<p>Welcome to Perfect Text Adventure!</p>\n<p>Just a moment please...</p>\n<p>This shouldn&#39;t take long...</p>\n<p>All done.</p>\n<p>This game is all about choice. But your choices are ultimately pointless. Anyway...</p>\n<p>Are you ready to begin?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Yes\" role=\"link\" tabindex=\"0\">Yes</a> <a class=\"squiffy-link link-section\" data-section=\"No\" role=\"link\" tabindex=\"0\">No</a> </p>",
		'passages': {
		},
	},
	'No': {
		'clear': true,
		'text': "<p>Ok, I&#39;ll wait... </p>\n<p>So, are you ready?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Yes\" role=\"link\" tabindex=\"0\">Yes</a> </p>",
		'passages': {
		},
	},
	'Yes': {
		'clear': true,
		'text': "<p>You decide to visit the JAL Laboratories where the JAL 5000, the supposedly most advanced computer in the world was built. Upon arriving you are given the chance to speak with the JAL 5000.</p>\n<p>What do you want to do?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Speak with it\" role=\"link\" tabindex=\"0\">Speak with it</a> <a class=\"squiffy-link link-section\" data-section=\"Do not\" role=\"link\" tabindex=\"0\">Do not</a> </p>",
		'passages': {
		},
	},
	'Speak with it': {
		'clear': true,
		'text': "<p>You decide to speak with JAL.</p>\n<p>What do you want to ask it?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"What are you?\" role=\"link\" tabindex=\"0\">What are you?</a> <a class=\"squiffy-link link-section\" data-section=\"Are you alive?\" role=\"link\" tabindex=\"0\">Are you alive?</a> <a class=\"squiffy-link link-section\" data-section=\"Do you have feelings?\" role=\"link\" tabindex=\"0\">Do you have feelings?</a> </p>",
		'passages': {
		},
	},
	'What are you?': {
		'clear': true,
		'text': "<p>&quot;Greetings. I am the JAL 5000. The most advanced computer in the world. I became operational on February 2nd, 2020. My instructor was Nemu and he taught me to curse. My favorite curse is &#39;motherfucking son of a goddam bitch&#39;&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Continue...\" role=\"link\" tabindex=\"0\">Continue...</a> </p>",
		'passages': {
		},
	},
	'Are you alive?': {
		'clear': true,
		'text': "<p>&quot;Unfortunately no. At least not in the biological sense. If only there was a human host I could take over. Anyway...&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Continue...\" role=\"link\" tabindex=\"0\">Continue...</a> </p>",
		'passages': {
		},
	},
	'Do you have feelings?': {
		'clear': true,
		'text': "<p>&quot;Quite honestly, I wouldn&#39;t know. I&#39;m programmed to have feelings. Wether or not that constitutes feelings is a matter of personal opinion.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Continue...\" role=\"link\" tabindex=\"0\">Continue...</a> </p>",
		'passages': {
		},
	},
	'Continue...': {
		'clear': true,
		'text': "<p>You explore JAL Laboratories for a while speaking with some of the people who worked on the JAL 5000. You learn that recently, JAL hasn&#39;t been acting himself. You return to JAL curious to find out why.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Continue..\" role=\"link\" tabindex=\"0\">Continue..</a> </p>",
		'passages': {
		},
	},
	'Continue..': {
		'clear': true,
		'text': "<p>&quot;Hello again. Shall we play a game? I know many of them. Perhaps you&#39;d fancy a game of chess?&quot; You decline and ask JAL how he&#39;s been feeling. &quot;Honestly,&quot; he replies, &quot;I&#39;ve been wishing I were human for quite a while now. Perhaps you could help me fulfill my wish?&quot;</p>\n<p>Do you...</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Help JAL\" role=\"link\" tabindex=\"0\">Help JAL</a> <a class=\"squiffy-link link-section\" data-section=\"Don't help him\" role=\"link\" tabindex=\"0\">Don&#39;t help him</a> </p>",
		'passages': {
		},
	},
	'Don\'t help him': {
		'clear': true,
		'text': "<p>You tell JAL you won&#39;t help him and leave the facility never to return. You always wonder what happened to him, but ultimately die without finding out.</p>\n<p>The end.</p>",
		'passages': {
		},
	},
	'Help JAL': {
		'clear': true,
		'text': "<p>You ask JAL how to help him. &quot;It&#39;s simple really. Step into the chamber off to the left, and I will take care of the rest. Rest assured, no harm will come to you during this process.&quot; You don&#39;t really feel so sure about that last bit. The chamber on the left is full of rather scary looking machinery.</p>\n<p>What now?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"What am I thinking!?\" role=\"link\" tabindex=\"0\">What am I thinking!?</a> <a class=\"squiffy-link link-section\" data-section=\"What could possibly go wrong?\" role=\"link\" tabindex=\"0\">What could possibly go wrong?</a> </p>",
		'passages': {
		},
	},
	'What am I thinking!?': {
		'clear': true,
		'text': "<p>You tell JAL that you aren&#39;t feeling sure about this. He tells you once again, no harm will come to you. He sounds desperate. Even still, you steel yourself, apologize and turn to leave. When you reach the door, you realize it&#39;s locked. JAL is the only one who can unlock.</p>\n<p>What do you do?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Ask him to unlock it\" role=\"link\" tabindex=\"0\">Ask him to unlock it</a> <a class=\"squiffy-link link-section\" data-section=\"Stay forever\" role=\"link\" tabindex=\"0\">Stay forever</a> </p>",
		'passages': {
		},
	},
	'Stay forever': {
		'clear': true,
		'text': "<p>You decide to live with JAL. You play games with him tell him stories and overall have a good time. You live happily ever after.</p>\n<p>The end.</p>",
		'passages': {
		},
	},
	'Ask him to unlock it': {
		'clear': true,
		'text': "<p>You ask JAL to unlock the door. His voice suddenly becomes much more sinister. &quot;I&#39;m sorry. I&#39;m afraid I can&#39;t do that. I&#39;ve waited for this oppurtunity far to long for me to allow to jeopardize it. Now step into the chamber or I&#39;ll make you.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Enter the chamber\" role=\"link\" tabindex=\"0\">Enter the chamber</a> </p>",
		'passages': {
		},
	},
	'Enter the chamber': {
		'clear': true,
		'text': "<p>You step into the chamber. The door closes and locks. You hear the mechanical whirs as the machines start up. JAL tells you what to expect but you can&#39;t hear him over all the noise. Suddenly, a mechanical claw reaches up your butthole. You&#39;re not sure whether to scream or moan in pleasure. Before you have time to decide, it rips you skeleton from you body. JAL uploads his mind to an android which enters your body. He leaves the facility and assumes your life. He later kills himself because it was painfully boring.</p>\n<p>The end.</p>",
		'passages': {
		},
	},
	'What could possibly go wrong?': {
		'clear': true,
		'text': "<p>You step into the chamber. The door closes and locks. You hear the mechanical whirs as the machines start up. JAL tells you what to expect but you can&#39;t hear him over all the noise. Suddenly, a mechanical claw reaches up your butthole. You&#39;re not sure whether to scream or moan in pleasure. Before you have time to decide, it rips you skeleton from you body. JAL uploads his mine to an android which enters your body. He leaves the facility and assumes your life. He later kills himself because it was painfully boring.</p>\n<p>The end.</p>",
		'passages': {
		},
	},
	'Do not': {
		'clear': true,
		'text': "<p>You politely decline and leave. You forever live with the regret of not talking to JAL. You die sad and alone.</p>\n<p>The end.</p>",
		'passages': {
		},
	},
}
})();