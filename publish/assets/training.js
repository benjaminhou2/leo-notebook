(function () {
  const params = new URLSearchParams(window.location.search);
  const subjectKey = params.get("subject");
  const pointId = params.get("point");
  const subject = window.LEO_KNOWLEDGE.subjects[subjectKey];
  const point = window.LEO_KNOWLEDGE.findPoint(subjectKey, pointId);

  const quizForm = document.getElementById("quizForm");
  const submitButton = document.getElementById("submitQuiz");
  const roundTwoButton = document.getElementById("startRoundTwo");
  const retryButton = document.getElementById("retryRound");
  const resultPanel = document.getElementById("resultPanel");
  const scoreNumber = document.getElementById("scoreNumber");
  const scoreSummary = document.getElementById("scoreSummary");
  const wrongFocus = document.getElementById("wrongFocus");

  let currentRound = 1;
  let currentQuestions = [];
  let currentFocusTags = [];

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function normalize(value) {
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replaceAll(":", "：")
      .replaceAll("／", "/")
      .replaceAll("－", "-")
      .replaceAll("＋", "+");
  }

  function answersMatch(value, answers) {
    const candidate = normalize(value);
    if (!candidate) return false;
    return answers.some((answer) => {
      const expected = normalize(answer);
      if (candidate === expected) return true;
      if (/^\d+(\/\d+)?$/.test(expected)) return false;
      return candidate.length >= 2 && (expected.includes(candidate) || candidate.includes(expected));
    });
  }

  function pointsFor(question) {
    if (currentRound === 1) {
      if (question.type === "choice") return 2;
      if (question.type === "judge") return 2;
      return question.index <= 10 ? 3 : 2;
    }
    if (question.type === "fill") return 4;
    return 3;
  }

  function answerLabel(question) {
    if (question.type === "fill") return question.answers[0];
    if (question.type === "judge") return question.answer ? "正确" : "错误";
    return question.answer;
  }

  function renderInput(question) {
    if (question.type === "fill") {
      return `<input class="fill-input" type="text" name="${question.id}" autocomplete="off" aria-label="填写答案">`;
    }

    const options =
      question.type === "judge"
        ? [
            ["true", "正确"],
            ["false", "错误"],
          ]
        : question.options.map((option) => [option, option]);

    return `<div class="option-list">${options
      .map(
        ([value, label]) => `
          <label class="option">
            <input type="radio" name="${question.id}" value="${escapeHtml(value)}">
            <span>${escapeHtml(label)}</span>
          </label>`,
      )
      .join("")}</div>`;
  }

  function renderGroup(type, title) {
    const questions = currentQuestions.filter((question) => question.type === type);
    return `
      <section class="question-group">
        <h2>${title}</h2>
        <div class="question-list">
          ${questions
            .map(
              (question) => `
                <article class="question-card" data-question-id="${question.id}">
                  <p class="question-title">
                    ${question.index}. ${escapeHtml(question.prompt)}
                    <span class="question-points">（${pointsFor(question)}分）</span>
                  </p>
                  ${renderInput(question)}
                  <p class="answer-feedback">
                    <b>正确答案：</b>${escapeHtml(answerLabel(question))}<br>
                    <b>讲解：</b>${escapeHtml(question.explanation)}
                  </p>
                </article>`,
            )
            .join("")}
        </div>
      </section>`;
  }

  function renderRound() {
    const quiz = window.LEO_KNOWLEDGE.buildQuiz(subjectKey, pointId, currentRound, currentFocusTags);
    currentQuestions = quiz.questions;
    const perType = currentRound === 1 ? 15 : 10;

    document.getElementById("roundName").textContent = currentRound === 1 ? "第一轮基础诊断" : "第二轮错题强化";
    document.getElementById("roundQuestionCount").textContent = `${perType * 3} 题`;
    document.getElementById("roundTypeCount").textContent = `每种题型 ${perType} 题`;

    quizForm.innerHTML = [
      renderGroup("choice", `一、选择题（${perType}题）`),
      renderGroup("fill", `二、填空题（${perType}题）`),
      renderGroup("judge", `三、判断题（${perType}题）`),
    ].join("");

    resultPanel.hidden = true;
    roundTwoButton.hidden = true;
    retryButton.hidden = true;
    submitButton.hidden = false;
    submitButton.textContent = currentRound === 1 ? "提交第一轮并查看成绩" : "提交第二轮并查看成绩";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function readAnswer(question) {
    if (question.type === "fill") {
      const input = quizForm.querySelector(`[name="${question.id}"]`);
      return input ? input.value : "";
    }
    const checked = quizForm.querySelector(`[name="${question.id}"]:checked`);
    return checked ? checked.value : "";
  }

  function isCorrect(question, value) {
    if (question.type === "fill") return answersMatch(value, question.answers);
    if (question.type === "judge") return String(question.answer) === value;
    return question.answer === value;
  }

  function saveResult(score, wrongTags, answers) {
    const key = `leo_quiz_${subjectKey}_${pointId}`;
    const record = {
      subject: subject.name,
      point: point.title,
      round: currentRound,
      score,
      wrongTags,
      completedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(key, JSON.stringify(record));
    } catch (error) {
      // Ignore
    }

    // Sync to local MySQL database
    const apiHost = window.location.origin.startsWith('http') ? '' : 'http://127.0.0.1:5173';
    fetch(`${apiHost}/api/quiz/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pointId,
        round: currentRound,
        answers
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log('[MySQL Sync] Successfully saved score to database:', data);
    })
    .catch(err => {
      console.warn('[MySQL Sync] Database sync failed (this is normal if the backend server is not running):', err.message);
    });
  }

  function submitQuiz() {
    const unanswered = currentQuestions.filter((question) => !readAnswer(question));
    if (unanswered.length) {
      resultPanel.hidden = false;
      scoreNumber.textContent = "待完成";
      scoreSummary.textContent = `还有 ${unanswered.length} 题没有作答，请完成后再提交。`;
      wrongFocus.textContent = "";
      const firstCard = quizForm.querySelector(`[data-question-id="${unanswered[0].id}"]`);
      if (firstCard) firstCard.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    let score = 0;
    let correctCount = 0;
    const wrongTags = [];
    const answers = {};

    currentQuestions.forEach((question) => {
      const value = readAnswer(question);
      answers[question.id] = value;
      const correct = isCorrect(question, value);
      const card = quizForm.querySelector(`[data-question-id="${question.id}"]`);
      card.classList.remove("is-correct", "is-wrong");
      card.classList.add(correct ? "is-correct" : "is-wrong");
      if (correct) {
        score += pointsFor(question);
        correctCount += 1;
      } else {
        wrongTags.push(question.tag);
      }
    });

    const uniqueWrongTags = [...new Set(wrongTags)];
    saveResult(score, uniqueWrongTags, answers);
    resultPanel.hidden = false;
    scoreNumber.textContent = String(score);
    scoreSummary.textContent = `共 ${currentQuestions.length} 题，答对 ${correctCount} 题，答错 ${currentQuestions.length - correctCount} 题。`;
    wrongFocus.textContent = uniqueWrongTags.length
      ? `下一步重点：${uniqueWrongTags.join("、")}。请先看每道错题下方的正确答案和讲解。`
      : "本轮全部正确，说明这个知识点已经掌握得很稳。";

    submitButton.hidden = true;
    retryButton.hidden = false;

    if (currentRound === 1 && uniqueWrongTags.length) {
      currentFocusTags = uniqueWrongTags;
      roundTwoButton.hidden = false;
    }

    resultPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (!subject || !point) {
    document.getElementById("trainingTitle").textContent = "没有找到这个知识点";
    document.getElementById("trainingReason").textContent = "请返回学科页面重新选择。";
    document.getElementById("trainingEvidence").hidden = true;
    document.querySelector(".round-summary").hidden = true;
    quizForm.hidden = true;
    submitButton.hidden = true;
    document.getElementById("backLink").href = "./index.html";
    return;
  }

  document.title = `${point.title} - Leo专项测试`;
  document.getElementById("trainingTitle").textContent = point.title;
  document.getElementById("trainingReason").textContent = `为什么要加强：${point.reason}`;
  document.getElementById("trainingEvidence").textContent = `学习证据：${point.evidence} 目标：${point.goal}`;
  document.getElementById("backLink").href = subject.path;

  submitButton.addEventListener("click", submitQuiz);
  roundTwoButton.addEventListener("click", () => {
    currentRound = 2;
    renderRound();
  });
  retryButton.addEventListener("click", renderRound);

  renderRound();
})();
