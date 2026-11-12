/* ================= Activity bank =================
   Ways to run a part of class, each with short how-to steps for the teacher and a ready set of
   student-facing steps for a slide. Written for this app in plain words. Where an activity is one of
   the routines in Fisher, Brozo, Frey & Ivey, 50 Instructional Routines to Develop Content Literacy
   (3rd ed., Pearson, 2015), "book" gives its routine number so the teacher can look up the full version.
   Only method names and routine numbers come from the book; every description and step here is the app's
   own wording, so keep it that way: never paste text, handouts or examples from the book into this file.
   parts: where it fits in a class (warmup, activity, review). Teachers add their own; those are saved
   with the Planner and written to the Planner folder as activities.json. */
const PARTS = { warmup: 'Warm-up', activity: 'Activity', review: 'Review' };
const KINDS = { talk: 'Discussion', read: 'Reading', write: 'Writing', words: 'Vocabulary', move: 'Movement and games', check: 'Checking understanding' };
const BOOK = '50 Instructional Routines (Fisher, Brozo, Frey & Ivey, 2015)';
const A = (id, name, kind, parts, group, what, how, slide, book, tip) => ({ id, name, kind, parts, group, what, how, slide, book: book || 0, tip: tip || '' });
const ACTIVITIES = [
  A('journal', 'Journal entry', 'write', ['warmup'], 'On their own', 'A short written response to one open question, in a notebook students keep all term.',
    ['Put one open question on the board that links to today’s text or idea.', 'Students write without stopping until you call time. Spelling doesn’t count here.', 'Ask two or three students to read a line aloud, or have partners swap and read.', 'Come back to the question at the end of class so the entry feeds the lesson.'],
    ['Open your journal to a new page', 'Write today’s date and the question', 'Write the whole time, without stopping', 'Be ready to share one line'], 31, 'Response Writing is routine 31.'),
  A('quickwrite-pair', 'Read, write, pair, share', 'write', ['warmup', 'activity'], 'Pairs', 'Students read a short piece, write about it on their own, then compare with a partner before the class talks.',
    ['Give a short passage and one question about it.', 'Students read and write an answer on their own first.', 'Partners read each other’s answer and agree or push back.', 'Call on pairs to share what changed when they talked.'],
    ['Read the passage', 'Write your answer on your own', 'Swap with your partner and compare', 'Get ready to share what you agreed on'], 28),
  A('think-pair-share', 'Think, pair, share', 'talk', ['warmup', 'activity', 'review'], 'Pairs', 'Quiet thinking, then a partner talk, then a few pairs share. A low-stakes way to get everyone talking.',
    ['Ask one question with more than one good answer.', 'Give quiet thinking time first.', 'Partners take turns: one talks, one listens, then switch.', 'Call on a few pairs. Ask what their partner said.'],
    ['Think on your own first', 'Talk with your partner: take turns', 'Be ready to share your partner’s idea'], 0),
  A('roundtable', 'Conversation roundtable', 'talk', ['activity'], 'Groups of 4', 'Each student folds a paper into four boxes: their own notes, then one box for each groupmate’s ideas as they speak.',
    ['Students fold a sheet into four boxes and write their name in one.', 'Everyone reads or thinks about the same question and writes their own notes in their box.', 'Each person shares in turn. The others write that person’s main idea in a box with their name on it.', 'Each student writes a short summary that pulls the four ideas together.'],
    ['Fold your paper into four boxes', 'Write your own ideas in your box', 'As each person shares, note their idea in a box', 'Write a summary that uses all four ideas'], 6),
  A('fishbowl', 'Fishbowl discussion', 'talk', ['activity'], 'Whole class', 'A small inner circle talks about a question while the outer circle listens and takes notes, then the circles switch or the outside joins in.',
    ['Pick a question people can disagree about.', 'Partners talk first so everyone has something to say.', 'Five or six students sit in the middle and talk; everyone else sits around them and tracks ideas or evidence.', 'Switch circles, or leave one empty chair for someone from outside to step in.', 'End by asking the outer circle what they noticed.'],
    ['Inner circle: talk about the question, using the text', 'Outer circle: note the best point and one question', 'Want to join? Take the empty chair'], 10),
  A('socratic', 'Socratic seminar', 'talk', ['activity'], 'Whole class', 'A student-led discussion of a text, with open questions and evidence. The teacher mostly listens.',
    ['Students read and annotate the text ahead of time and write two open questions.', 'Seat everyone in a circle. Share a few norms, like building on what the last person said.', 'Open with one question, then step back. Students call on each other.', 'Close with each student naming one idea that changed their thinking.'],
    ['Bring your marked-up text and two questions', 'Point to the text when you make a claim', 'Build on what the last person said', 'Invite someone who hasn’t spoken yet'], 34),
  A('debate', 'Four-corners debate', 'move', ['warmup', 'activity'], 'Whole class', 'Students move to a corner (strongly agree to strongly disagree) and defend their spot. People can change corners when they hear a good point.',
    ['Post four signs: strongly agree, agree, disagree, strongly disagree.', 'Read one statement. Students move to a corner.', 'Each corner talks briefly, then sends one speaker.', 'Let anyone move when an argument convinces them, and ask what changed their mind.'],
    ['Listen to the statement', 'Walk to the corner that fits what you think', 'Talk with your corner: why are you here?', 'Changed your mind? Move, and tell us why'], 7, 'Debate is routine 7; the corners make it quick to run.'),
  A('opinionnaire', 'Opinionnaire', 'talk', ['warmup'], 'On their own, then pairs', 'Students mark agree or disagree on a few bold statements before reading, then come back to them after.',
    ['Write four or five strong statements tied to the text’s big ideas.', 'Students mark agree or disagree and add a reason.', 'Partners compare. Take a quick poll on the most split statement.', 'After reading, students look again: would they change any answers?'],
    ['Agree or disagree with each statement', 'Write one reason for each', 'Compare with a partner', 'We’ll come back to these after reading'], 21),
  A('anticipation', 'Anticipation guide', 'read', ['warmup'], 'On their own', 'True or false guesses about what a text will say, checked against the text afterward.',
    ['Write several statements about the text, some true, some not.', 'Students guess true or false before reading.', 'As they read, they look for the line that settles each one.', 'They correct their guesses and quote the line that proves it.'],
    ['Guess: true or false?', 'Read and look for the answers', 'Fix your guesses and quote the line'], 3),
  A('close-read', 'Close reading', 'read', ['activity'], 'On their own, then whole class', 'A short, rich passage read more than once, with a different question each time.',
    ['Choose a short passage worth slowing down for.', 'First read: what is it saying? Students annotate.', 'Second read: how is it written? Word choice, structure, tone.', 'Third read: what does it mean, and why does it matter? Discuss using the text.'],
    ['Read once: what is it saying?', 'Read again: mark words and choices that stand out', 'Read a third time: what does it mean?', 'Use the text when you share'], 4),
  A('annotation', 'Annotation with a code', 'read', ['activity'], 'On their own', 'Students mark the text with a small set of symbols as they read, so their thinking is on the page.',
    ['Give three or four symbols, like ! for a surprise, ? for a question, * for something important.', 'Model one paragraph out loud.', 'Students annotate the rest on their own.', 'Partners compare one mark each and explain it.'],
    ['! something that surprised you', '? something you’d ask the author', '* something important', 'Explain one mark to your partner'], 2),
  A('jigsaw', 'Jigsaw', 'read', ['activity'], 'Groups', 'Each member of a home group becomes the expert on one part, meets other experts on it, then teaches it back home.',
    ['Split the material into parts, one per group member.', 'Expert groups meet: same part, read it and agree on what matters.', 'Students return home and teach their part in turn.', 'Finish with a task that needs every part.'],
    ['Read your part with your expert group', 'Agree on the three most important points', 'Go home and teach your part', 'Answer the group question together'], 16),
  A('reciprocal', 'Reciprocal teaching', 'read', ['activity'], 'Groups of 4', 'Small groups read together, with four jobs: predict, question, clear up, summarize.',
    ['Hand out four role cards: predictor, questioner, clarifier, summarizer.', 'Groups read a chunk, then each role does its job.', 'Rotate roles every chunk.', 'Check in with each group and listen to one role.'],
    ['Predictor: what will happen next?', 'Questioner: ask the group a question', 'Clarifier: clear up a confusing part', 'Summarizer: sum it up in a sentence'], 29),
  A('qar', 'Question-answer types', 'read', ['activity'], 'Pairs', 'Students sort questions by where the answer comes from: right there, think and search, the author and me, on my own.',
    ['Teach the four types with one easy example each.', 'Give a set of questions on the text.', 'Pairs label each question’s type, then answer it.', 'Talk about which types were hardest and why.'],
    ['Right there: in one place', 'Think and search: put parts together', 'Author and me: the text plus what you know', 'On my own: from your own life'], 23),
  A('qta', 'Questioning the author', 'read', ['activity'], 'Whole class', 'Stop during a read to ask what the author is trying to say and why they said it that way.',
    ['Pick stopping points ahead of time.', 'At each stop ask: What is the author trying to tell us? Why put it this way?', 'Push for evidence: Where does it say that?', 'Connect stops: How does this fit with what the author said before?'],
    ['What is the author trying to say?', 'Why did they say it this way?', 'Does it make sense with what came before?'], 24),
  A('dr-ta', 'Predict, read, check', 'read', ['activity'], 'Whole class', 'Students predict, read to a stopping point, check their prediction against the text, then predict again.',
    ['Start from the title, a picture or the first lines and ask for predictions.', 'Read to the first stop.', 'Ask: Were you right? What in the text tells you?', 'Repeat at each stop, then talk about how the predictions changed.'],
    ['Predict what happens', 'Read to the stop', 'Check: right or not? Show the line', 'Predict again'], 8),
  A('text-impressions', 'Text impressions', 'write', ['warmup'], 'Pairs', 'From a short list of key words in order, students write their own short version of the text before reading it.',
    ['Pull eight to twelve key words from the text, in order.', 'Pairs write a short paragraph using the words in that order.', 'Read the real text.', 'Compare: what did you guess well, and what surprised you?'],
    ['Use these words, in order', 'Write what you think the text is about', 'Read it, then compare'], 40),
  A('found-poem', 'Found poem', 'write', ['activity', 'review'], 'On their own or pairs', 'Students build a poem only from words and lines they find in a text.',
    ['Students skim the text and copy lines and phrases that stand out.', 'They arrange the pieces into a short poem, adding nothing new.', 'Share a few aloud.', 'Ask what the poem shows about the text’s big idea.'],
    ['Copy words and lines that stand out', 'Arrange them into a poem', 'Only words from the text', 'Give it a title'], 11),
  A('raft', 'RAFT writing', 'write', ['activity'], 'On their own', 'Students write as a Role, to an Audience, in a Format, about a Topic, which makes them think about voice and purpose.',
    ['Give a RAFT, like a character writing a letter to another character about a choice.', 'Brainstorm what that role would know and care about.', 'Students write.', 'Share a few and ask how the role changed the writing.'],
    ['Role: who you are', 'Audience: who you’re writing to', 'Format: what kind of writing', 'Topic: what it’s about'], 25),
  A('split-notes', 'Two-column notes', 'write', ['activity'], 'On their own', 'Main ideas on the left, details and examples on the right, so notes can be used to study later.',
    ['Students draw a line down the page, about a third from the left.', 'Big ideas or questions go on the left, details on the right.', 'Afterward, they cover the right side and quiz themselves from the left.'],
    ['Big ideas on the left', 'Details and examples on the right', 'Cover the right side and quiz yourself'], 35),
  A('writing-frame', 'Sentence frames', 'write', ['activity'], 'On their own', 'Starter sentences that show the shape of a good answer, used as a scaffold and then dropped.',
    ['Give two or three frames, like “At first ___, but ___ because ___.”', 'Model one with a sample answer.', 'Students write using the frames.', 'Next time, give fewer frames.'],
    ['Use the frames to start your sentences', 'Fill in your own ideas and evidence'], 50),
  A('exit-slip', 'Exit ticket', 'check', ['review'], 'On their own', 'One or two quick questions at the end of class to see what stuck.',
    ['Ask one question that shows whether today’s goal was met.', 'Students answer on a slip or a sticky note.', 'Sort the slips into got it, almost, not yet, and start tomorrow from there.'],
    ['Answer the question on your sticky note', 'Put your name on it', 'Hand it in on your way out'], 9),
  A('popcorn', 'Popcorn review', 'check', ['review'], 'Whole class', 'Students stand and share one thing they learned; each person adds something new until everyone has spoken.',
    ['Everyone stands.', 'One student shares a fact or idea from the lesson and sits.', 'The next person adds something that hasn’t been said yet.', 'Keep going until everyone has shared.'],
    ['Stand up', 'Share one thing you learned, then sit', 'No repeats: add something new'], 22),
  A('take6', 'Take 6', 'check', ['review'], 'Pairs', 'Six quick prompts that pull a lesson together: two to recall, two to connect, two to use.',
    ['Write six short prompts about the lesson.', 'Partners take turns answering them.', 'Go over the two hardest as a class.'],
    ['Answer the six questions with your partner', 'Take turns: one answers, one checks'], 38),
  A('trashketball', 'Trashketball', 'move', ['review'], 'Teams', 'Teams answer review questions; a right answer earns a shot at a trash can for bonus points.',
    ['Make teams and a set of review questions.', 'Ask a question. Every team writes an answer.', 'Teams that got it right earn a shot from a line (closer line, fewer points).', 'Keep score on the board and go over any question most teams missed.'],
    ['Answer with your team', 'Right answer: one shot at the basket', 'Close line 1 point, far line 2 points'], 0, 'A classroom favorite; not in the book.'),
  A('gallery-walk', 'Gallery walk', 'move', ['activity', 'review'], 'Groups', 'Work or prompts are posted around the room; groups rotate and leave notes on each.',
    ['Post work, quotes or questions around the room.', 'Groups visit each station and leave a sticky note.', 'Rotate on a signal.', 'Back at their seats, groups talk about what they saw most.'],
    ['Visit each poster with your group', 'Leave one sticky note at each', 'Move on when you hear the signal', 'Back at your seat: what stood out?'], 0),
  A('stations', 'Stations', 'move', ['activity'], 'Groups', 'Different short tasks at different tables; groups rotate through them.',
    ['Set up three to five stations, each with clear written steps.', 'Groups start at different stations.', 'Rotate on a signal.', 'End with one question that pulls the stations together.'],
    ['Read the steps at your station', 'Do the task with your group', 'Move when you hear the signal'], 0),
  A('readers-theatre', 'Readers’ theatre', 'read', ['activity'], 'Groups', 'Students turn a scene or passage into a short script and read it aloud with expression, no props needed.',
    ['Choose a scene with several voices.', 'Groups split the lines and mark how to say them.', 'Practice once, then perform.', 'Ask what the performance showed about the characters.'],
    ['Split the lines in your group', 'Mark how each line should sound', 'Practice once, then perform'], 27),
  A('charades', 'Charades', 'move', ['warmup', 'review'], 'Teams', 'A student acts out a word, idea or moment from the text; their team guesses.',
    ['Write words or moments on cards.', 'One student acts it out without talking.', 'Their team guesses.', 'Ask what in the acting gave it away.'],
    ['Act it out: no words', 'Your team guesses', 'Then: what gave it away?'], 0),
  A('see-think-wonder', 'See, think, wonder', 'talk', ['warmup', 'activity'], 'Pairs', 'Students look closely at an image, then say what they see, what they think about it and what they wonder.',
    ['Show one rich image.', 'Students list what they see, only what is visible.', 'Then what they think is going on, with reasons from the image.', 'Then what they wonder. Keep the questions for later.'],
    ['What do you see?', 'What do you think is going on?', 'What do you wonder?'], 0, 'A thinking routine from Project Zero at the Harvard Graduate School of Education.'),
  A('kwl', 'Know, want to know, learned', 'check', ['warmup', 'review'], 'Whole class', 'A three-column chart: what we already know, what we want to find out, and what we learned.',
    ['Students list what they already know about the topic.', 'Then what they want to know.', 'At the end of the lesson or unit, fill in what they learned.', 'Check the middle column: what’s still open?'],
    ['Know: what do you already know?', 'Want: what do you want to find out?', 'Learned: fill this in at the end'], 17),
  A('word-sort', 'Word sort', 'words', ['warmup', 'activity'], 'Pairs', 'Students sort word cards into groups, either into given categories or groups they invent and name.',
    ['Make a set of word cards from the text or unit.', 'Pairs sort them into groups.', 'Each pair explains one group.', 'Talk about words that could go in more than one group.'],
    ['Sort the words into groups', 'Name each group', 'Explain one group to the class'], 48),
  A('shades', 'Shades of meaning', 'words', ['warmup', 'activity'], 'Pairs', 'Students line up related words from mild to strong, like annoyed, angry, furious.',
    ['Give a set of related words.', 'Pairs put them in order from weakest to strongest.', 'Compare orders across pairs and argue the close calls.', 'Use one word in a sentence that shows its strength.'],
    ['Put the words in order, weakest to strongest', 'Compare with another pair', 'Write a sentence with one word'], 32),
  A('vocab-cards', 'Vocabulary cards', 'words', ['activity'], 'On their own', 'Each card has a word, its meaning in the student’s own words, an example, and a picture or a non-example.',
    ['Give the words for the unit.', 'Students make a card for each: word, own meaning, example, picture.', 'Partners quiz each other with the cards.'],
    ['Word on the front', 'Your own meaning and an example on the back', 'Add a picture', 'Quiz a partner'], 44),
  A('tossed-terms', 'Tossed terms', 'words', ['warmup'], 'Groups', 'Groups get a handful of key terms from a text and predict how they connect before reading.',
    ['Give each group eight to ten terms.', 'Groups sort them and predict how they relate.', 'Read the text and check the predictions.'],
    ['Sort the terms with your group', 'Predict how they connect', 'Read and check'], 43),
  A('word-scavenger', 'Word scavenger hunt', 'words', ['activity'], 'Pairs', 'Students hunt through a text for words that fit a category, like strong verbs or words that show mood.',
    ['Name the categories to hunt for.', 'Pairs search the text and list what they find with page numbers.', 'Share the best find in each category.'],
    ['Hunt for words that fit each category', 'Write the page number for each', 'Share your best find'], 47),
  A('think-aloud', 'Think aloud', 'read', ['activity'], 'Whole class', 'The teacher or a student reads and says their thinking out loud, so the class hears how a reader works through a hard part.',
    ['Pick a short, tricky passage.', 'Read and say your thinking: questions, guesses, fix-ups.', 'Ask students what they heard you do.', 'Students try it with a partner on the next paragraph.'],
    ['Listen to how a reader thinks', 'Name one thing the reader did', 'Try it on the next part with your partner'], 42),
  A('student-questions', 'Student questions', 'talk', ['warmup', 'activity'], 'Groups', 'Students write their own questions about a topic and use them to drive the reading or discussion.',
    ['Show a prompt: an image, a quote, a short clip.', 'Groups write as many questions as they can without answering them.', 'They pick their three best and say why.', 'Use those questions for the reading or discussion.'],
    ['Write as many questions as you can', 'Don’t answer them yet', 'Pick your three best'], 37),
  A('booktalk', 'Student booktalks', 'talk', ['activity'], 'On their own', 'A short talk where a student sells a book they read to the class.',
    ['Show a sample booktalk: hook, a little plot, no ending, why read it.', 'Students plan a short talk.', 'Run a few each day.'],
    ['Hook us in', 'Tell a little, not the ending', 'Say who would like it'], 36)
];

/* ---------- see it in action ----------
   A public classroom video for an activity, picked from channels that tend to keep their videos up
   (Edutopia, EL Education, Reading Rockets, Project Zero, regional teacher centers). Each is a YouTube id,
   who made it and its length. An activity with no good video gets a YouTube search for its name instead,
   so the button never leads nowhere. A teacher's own activity can carry its own video link. */
const VIDEOS = {
  'journal': ['ZeaO-0_Kc3g', 'Edutopia', '1 min'], 'quickwrite-pair': ['H5BWms1KAKk', 'Edutopia', '3 min'],
  'think-pair-share': ['P4xUbicJTA4', 'EL Education', '3 min'], 'fishbowl': ['JVCFGLVZA3w', 'Edutopia', '1 min'],
  'socratic': ['e3IBLKYaK1E', 'Edutopia', '4 min'], 'debate': ['M2XmJQ9FL5A', 'ESC Region 13', '2 min'],
  'anticipation': ['jQCKXQUquTc', 'Reading Rockets', '8 min'], 'close-read': ['84VyogMSuv0', 'EL Education', '8 min'],
  'jigsaw': ['VsI9EpSSavo', 'Edutopia', '3 min'], 'reciprocal': ['My68SDGeTHI', 'Reading Rockets', '2 min'],
  'qta': ['tAIj2MqEz9s', 'Literacy How', '3 min'], 'dr-ta': ['ya6c1Im3-NU', 'Willans Hill', '3 min'],
  'split-notes': ['nX-xshA_0m8', 'Cornell Learning Strategies Center', '4 min'], 'writing-frame': ['f3rXwstobh8', 'Colorín Colorado', '1 min'],
  'exit-slip': ['PWUxFSXEsC8', 'Edutopia', '5 min'], 'trashketball': ['rOZlSwLUQGw', 'Ole Miss News', '3 min'],
  'gallery-walk': ['ElVO7RWAxa4', 'ESC Region 13', '2 min'], 'stations': ['Kg38A1ggYiE', 'Edutopia', '5 min'],
  'readers-theatre': ['4L5q0Y8hukU', 'Chase Young', '6 min'], 'see-think-wonder': ['oKV_S5NpDdc', 'Project Zero', '5 min'],
  'kwl': ['5JYkfJnqAbk', 'Educational Partners International', '4 min'], 'word-sort': ['d_R5wfmWIlQ', 'Reading Rockets', '6 min'],
  'vocab-cards': ['x83RVBIAnYQ', 'ESC Region 13', '2 min'], 'think-aloud': ['UmhLgsBD1-I', 'Smekens Education', '2 min'],
  'student-questions': ['JJJ6V4p1nfs', 'Right Question Institute', '1 min'], 'booktalk': ['lH5LghhwQDQ', 'We Are Teachers', '2 min']
};
const vidOk = u => /^https?:\/\/\S+$/i.test(String(u || '').trim());
// { url, note, found } — found: a picked or own video; otherwise a search for the activity's name.
function actVideo(a) {
  if (a.mine && vidOk(a.video)) return { url: a.video.trim(), note: 'Your video link', found: true };
  const v = !a.mine && VIDEOS[a.id];
  if (v) return { url: 'https://www.youtube.com/watch?v=' + v[0], note: v[1] + ', ' + v[2], found: true };
  return { url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(a.name + ' classroom strategy'), note: 'Search YouTube for classroom videos', found: false };
}
const actVidHtml = (a, cls) => { const v = actVideo(a); return '<a class="' + cls + '" href="' + esc(v.url) + '" target="_blank" rel="noopener" data-vid="' + (v.found ? 'found' : 'search') + '" title="' + esc(v.note) + '">' + (v.found ? '▶ See it in action' : 'Find a video') + ' ↗</a>'; };

/* ---------- the bank view ---------- */
const AB = { q: '', part: '', kind: '' };
async function myActivities() { return ((await kvGet('activities')) || []).filter(a => a && a.name); }
async function allActivities() { return [...(await myActivities()).map(a => ({ ...a, mine: true })), ...ACTIVITIES]; }
async function renderActivities() {
  const all = await allActivities(), q = AB.q.toLowerCase();
  const list = all.filter(a => (!AB.part || a.parts.includes(AB.part)) && (!AB.kind || a.kind === AB.kind) && (!q || (a.name + ' ' + a.what).toLowerCase().includes(q)));
  let h = topBar('activities', '<button class="btn sm" data-a="newact">+ My own activity</button>');
  h += '<div class="pl-bank"><div class="pl-filters"><input type="search" class="btn sm" data-f="actq" placeholder="Find an activity" value="' + esc(AB.q) + '">' +
    '<span class="pl-chips">' + ['', ...Object.keys(PARTS)].map(p => '<button class="pl-chip' + (AB.part === p ? ' on' : '') + '" data-a="actpart" data-v="' + p + '">' + (p ? PARTS[p] : 'Any part') + '</button>').join('') + '</span>' +
    '<span class="pl-chips">' + ['', ...Object.keys(KINDS)].map(k => '<button class="pl-chip' + (AB.kind === k ? ' on' : '') + '" data-a="actkind" data-v="' + k + '">' + (k ? KINDS[k] : 'Any kind') + '</button>').join('') + '</span></div>' +
    '<div class="pl-acts">' + (list.length ? list.map(actCard).join('') : '<p class="muted">Nothing matches. Try another word or filter.</p>') + '</div>' +
    '<p class="muted pl-credit">Activities marked with a routine number are in ' + esc(BOOK) + ', where you’ll find the research and classroom examples. The steps here are short versions written for this app.</p></div>';
  $('#lessons').innerHTML = h;
}
function actCard(a) {
  return '<article class="pl-act"><div class="pl-ah"><h3>' + esc(a.name) + '</h3>' + (a.mine ? '<span class="pl-st st-claude">Mine</span>' : '') + '</div>' +
    '<div class="pl-meta2">' + a.parts.map(p => '<span>' + PARTS[p] + '</span>').join('') + '<span>' + esc(KINDS[a.kind] || '') + '</span><span>' + esc(a.group) + '</span>' + (a.book ? '<span title="' + esc(BOOK) + '">Routine ' + a.book + '</span>' : '') + '</div>' +
    '<p>' + esc(a.what) + '</p><details><summary>How to run it</summary><ol>' + a.how.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' + (a.tip ? '<p class="muted">' + esc(a.tip) + '</p>' : '') + '</details>' +
    '<div class="pl-aa"><button class="btn sm primary" data-a="useact" data-id="' + esc(a.id) + '">Add to a lesson…</button>' + actVidHtml(a, 'btn sm') + (a.mine ? '<button class="btn sm ghost" data-a="editact" data-id="' + esc(a.id) + '">Edit</button>' : '') + '</div></article>';
}
const actSlide = a => normSlide({ layout: 'steps', title: a.name, body: a.slide.map((x, i) => (i + 1) + '. ' + x).join('\n'), size: 32, fmt: 2, notes: 'How to run it:\n' + a.how.map((x, i) => (i + 1) + '. ' + x).join('\n') + (a.book ? '\n(' + BOOK + ', routine ' + a.book + ')' : '') + (actVideo(a).found ? '\nSee it in action: ' + actVideo(a).url : '') });

/* ---------- the bank in the side panel, next to the lesson you're on ---------- */
const SA = { q: '', part: '', kind: '', open: '' };
async function spActsList() {
  const q = SA.q.toLowerCase();
  const list = (await allActivities()).filter(a => (!SA.part || a.parts.includes(SA.part)) && (!SA.kind || a.kind === SA.kind) && (!q || (a.name + ' ' + a.what + ' ' + a.group + (a.book ? ' routine ' + a.book : '')).toLowerCase().includes(q)));
  if (!list.length) return '<p class="muted sp-small">Nothing matches. Try another word or filter.</p>';
  const can = L.view === 'edit' && L.open;
  return list.map(a => {
    const open = SA.open === a.id;
    return '<div class="sp-act' + (open ? ' open' : '') + '"><button class="sp-act-h" data-sact="' + esc(a.id) + '"><b>' + esc(a.name) + '</b><span>' + a.parts.map(p => PARTS[p]).join(' · ') + ' · ' + esc(a.group) + (a.book ? ' · Routine ' + a.book : '') + (a.mine ? ' · Mine' : '') + '</span></button>' +
      (open ? '<div class="sp-act-b"><p>' + esc(a.what) + '</p><b class="sp-small">How to run it</b><ol>' + a.how.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' + (a.tip ? '<p class="muted sp-small">' + esc(a.tip) + '</p>' : '') +
        '<b class="sp-small">On the slide for students</b><ol>' + a.slide.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' +
        '<div class="sp-act-aa">' + (can ? '<button class="btn sm primary" data-sactadd="' + esc(a.id) + '">+ Add after the slide I’m on</button>' : '<button class="btn sm" data-sactuse="' + esc(a.id) + '">Add to a lesson…</button>') + actVidHtml(a, 'btn sm') + '</div></div>' : '') + '</div>';
  }).join('');
}
async function spActsHtml() {
  return '<div class="sp-acts"><input type="search" class="btn sm" data-sf="actq" placeholder="Find an activity, or a routine number" value="' + esc(SA.q) + '" style="width:100%;justify-content:flex-start">' +
    '<div class="pl-chips">' + ['', ...Object.keys(PARTS)].map(p => '<button class="pl-chip' + (SA.part === p ? ' on' : '') + '" data-sactp="' + p + '">' + (p ? PARTS[p] : 'Any part') + '</button>').join('') + '</div>' +
    '<div class="pl-chips">' + ['', ...Object.keys(KINDS)].map(k => '<button class="pl-chip' + (SA.kind === k ? ' on' : '') + '" data-sactk="' + k + '">' + (k ? KINDS[k] : 'Any kind') + '</button>').join('') + '</div>' +
    '<div id="spActList">' + await spActsList() + '</div><p class="muted sp-small">Routine numbers are from ' + esc(BOOK) + '. Open the book under Books for the full version.</p></div>';
}
async function spActsRefresh() { const el = $('#spActList'); if (el) el.innerHTML = await spActsList(); }
async function spActsClick(e) {
  const t = e.target.closest('[data-sact],[data-sactp],[data-sactk],[data-sactadd],[data-sactuse]'); if (!t) return false;
  if (t.dataset.sact != null) { SA.open = SA.open === t.dataset.sact ? '' : t.dataset.sact; await spActsRefresh(); return true; }
  if (t.dataset.sactp != null) { SA.part = t.dataset.sactp; panelRender(); return true; }
  if (t.dataset.sactk != null) { SA.kind = t.dataset.sactk; panelRender(); return true; }
  const a = (await allActivities()).find(x => x.id === (t.dataset.sactadd || t.dataset.sactuse)); if (!a) return true;
  if (t.dataset.sactuse) { await useActivity(a.id); return true; }
  const l = L.open; if (!l) return true;
  editorCommit();
  const at = L.cur + 1; l.slides.splice(at, 0, actSlide(a)); L.cur = at;
  lessonChanged(false); renderEditor(); await spActsRefresh();
  toast('Added “' + a.name + '” as slide ' + (at + 1) + '. The how-to steps are in the speaker notes.', 5000);
  return true;
}
let spActT;
function spActsInput(e) { if (e.target.dataset.sf !== 'actq') return false; SA.q = e.target.value; clearTimeout(spActT); spActT = setTimeout(spActsRefresh, 150); return true; }

// A Directions slide made from the activity's student steps, put after the current slide of a lesson.
async function useActivity(id) {
  const a = (await allActivities()).find(x => x.id === id); if (!a) return;
  const ls = [...L.lessons].sort((x, y) => ((y.slots[0] || {}).date || '').localeCompare((x.slots[0] || {}).date || '') || y.updated - x.updated);
  const today = ymd(new Date()), soon = ls.filter(l => l.slots.some(s => s.date >= today)).reverse();
  const pick = l => '<button class="ls-card" data-pk="' + l.id + '"><b>' + esc(l.title) + '</b><span>' + (l.slots.length ? esc(l.slots.map(s => className(s.classId) + ' ' + shortDate(s.date)).join(', ')) : 'Not on a class') + '</span></button>';
  openDlg('<div class="bh"><h2>Add “' + esc(a.name) + '” to a lesson</h2></div><div class="bb"><p class="muted" style="margin-top:0">It goes in as a slide with these steps for students. You can change the wording on the slide.</p><ol class="pl-prev">' + a.slide.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' +
    (L.open ? '<h3 class="pl-h3">The lesson you had open</h3><div class="ls-pick">' + pick(L.open) + '</div>' : '') +
    (soon.length ? '<h3 class="pl-h3">Coming up</h3><div class="ls-pick">' + soon.slice(0, 8).map(pick).join('') + '</div>' : '') +
    '<h3 class="pl-h3">Or</h3><button class="btn" data-newl>Start a new lesson with it</button></div><div class="bf"><button class="btn" data-x>Cancel</button></div>');
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    let l = null;
    if (e.target.closest('[data-newl]')) { l = normLesson({ title: a.name, slots: [], slides: [{ layout: 'title', title: a.name }] }); }
    else { const b = e.target.closest('[data-pk]'); if (!b) return; l = L.lessons.find(x => x.id === b.dataset.pk); }
    const s = actSlide(a);
    const at = L.open === l ? L.cur + 1 : l.slides.length;
    l.slides.splice(at, 0, s);
    if (e.target.closest('[data-newl]')) deckStart(l);
    await lPut(l); closeDlg();
    L.open = l; L.cur = l.slides.indexOf(s); L.backTo = 'activities'; L.view = 'edit'; renderEditor();
    toast('Added to “' + l.title + '”. The how-to steps are in the speaker notes.', 5000);
  };
}
async function actEditDlg(id) {
  const mine = await myActivities(), a = mine.find(x => x.id === id) || { id: 'my-' + lid(), name: '', kind: 'talk', parts: ['activity'], group: '', what: '', how: [], slide: [] };
  openDlg('<div class="bh"><h2>' + (a.name ? 'Edit ' + esc(a.name) : 'My own activity') + '</h2></div><div class="bb">' +
    '<label class="ls-f">Name<input id="aeN" class="btn" style="justify-content:flex-start" value="' + esc(a.name) + '"></label>' +
    '<label class="ls-f">What it is (one or two sentences)<textarea id="aeW" rows="2">' + esc(a.what) + '</textarea></label>' +
    '<div class="ls-mrow"><label>Kind <select id="aeK" class="btn sm">' + Object.entries(KINDS).map(([k, v]) => '<option value="' + k + '"' + (k === a.kind ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
    Object.entries(PARTS).map(([k, v]) => '<label><input type="checkbox" data-part="' + k + '"' + (a.parts.includes(k) ? ' checked' : '') + '> ' + v + '</label>').join('') +
    '<label>Grouping <input id="aeG" class="btn sm" value="' + esc(a.group) + '" placeholder="Pairs, groups of 4…"></label></div>' +
    '<label class="ls-f">How to run it (one step per line)<textarea id="aeH" rows="5">' + esc(a.how.join('\n')) + '</textarea></label>' +
    '<label class="ls-f">Steps for students on the slide (one per line)<textarea id="aeS" rows="4">' + esc(a.slide.join('\n')) + '</textarea></label>' +
    '<label class="ls-f">A video of it in action (optional)<input id="aeV" class="btn" style="justify-content:flex-start" placeholder="https://…" value="' + esc(a.video || '') + '"></label></div>' +
    '<div class="bf">' + (mine.some(x => x.id === a.id) ? '<button class="btn" data-del>Delete</button><span style="flex:1"></span>' : '') + '<button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Save</button></div>');
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    if (e.target.closest('[data-del]')) { await kvSet('activities', mine.filter(x => x.id !== a.id)); await actFolderWrite(); closeDlg(); return renderActivities(); }
    if (!e.target.closest('[data-ok]')) return;
    const lines = id => $(id).value.split('\n').map(x => x.trim()).filter(Boolean);
    const n = { id: a.id, name: $('#aeN').value.trim(), what: $('#aeW').value.trim(), kind: $('#aeK').value, parts: [...document.querySelectorAll('[data-part]')].filter(c => c.checked).map(c => c.dataset.part), group: $('#aeG').value.trim(), how: lines('#aeH'), slide: lines('#aeS'), book: 0, tip: '' };
    const vid = $('#aeV').value.trim(); if (vid && !vidOk(vid)) return toast('The video link needs to start with https://'); if (vid) n.video = vid;
    if (!n.name) return toast('Give it a name');
    if (!n.parts.length) n.parts = ['activity'];
    await kvSet('activities', [n, ...mine.filter(x => x.id !== a.id)]); await actFolderWrite(); closeDlg(); AB.q = AB.part = AB.kind = ''; renderActivities();
  };
}
function normActivity(x) {
  if (!x || typeof x.name !== 'string' || !x.name.trim()) return null;
  const arr = v => (Array.isArray(v) ? v : []).map(String).filter(Boolean);
  return { id: typeof x.id === 'string' && x.id ? x.id : 'my-' + lid(), name: x.name.trim(), what: String(x.what || ''), kind: KINDS[x.kind] ? x.kind : 'talk', parts: arr(x.parts).filter(p => PARTS[p]).length ? arr(x.parts).filter(p => PARTS[p]) : ['activity'], group: String(x.group || ''), how: arr(x.how), slide: arr(x.slide), book: 0, tip: String(x.tip || ''), ...(vidOk(x.video) ? { video: String(x.video).trim() } : {}) };
}
// Her own activities go to the folder as activities.json, so Claude can read them and add new ones.
let actMod = 0;
async function actFolderWrite() { if (!L.dir || !L.dirOk) return; actMod = await writeFile(L.dir, 'activities.json', JSON.stringify(await myActivities(), null, 2)); }
async function actFolderRead() {
  if (!L.dir || !L.dirOk) return 0;
  let f; try { f = await (await L.dir.getFileHandle('activities.json')).getFile(); } catch { return 0; }
  if (actMod && f.lastModified <= actMod + 1500) return 0;
  let j; try { j = JSON.parse(await f.text()); } catch { return 0; }
  const list = (Array.isArray(j) ? j : []).map(normActivity).filter(Boolean);
  const before = JSON.stringify(await myActivities());
  await kvSet('activities', list); actMod = f.lastModified;
  return JSON.stringify(list) !== before ? 1 : 0;
}
async function activitiesClick(t) {
  const a = t.dataset.a;
  if (a === 'actpart') { AB.part = t.dataset.v; renderActivities(); return true; }
  if (a === 'actkind') { AB.kind = t.dataset.v; renderActivities(); return true; }
  if (a === 'useact') { await useActivity(t.dataset.id); return true; }
  if (a === 'newact') { await actEditDlg(''); return true; }
  if (a === 'editact') { await actEditDlg(t.dataset.id); return true; }
  return false;
}
let actQT;
function activitiesInput(e) { if (e.target.dataset.f !== 'actq') return false; AB.q = e.target.value; clearTimeout(actQT); actQT = setTimeout(() => { renderActivities().then(() => { const i = document.querySelector('[data-f="actq"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 200); return true; }
