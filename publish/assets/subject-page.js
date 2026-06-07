(function () {
  const subjectKey = document.body.dataset.subject;
  const container = document.getElementById("knowledgeList");
  const empty = document.getElementById("knowledgeEmpty");
  if (!container || !window.LEO_KNOWLEDGE) return;

  const subject = window.LEO_KNOWLEDGE.subjects[subjectKey];
  if (!subject || !subject.points.length) {
    if (empty) empty.hidden = false;
    return;
  }

  container.innerHTML = subject.points
    .map(
      (point, index) => `
        <a class="knowledge-card" href="../training.html?subject=${encodeURIComponent(subjectKey)}&point=${encodeURIComponent(point.id)}">
          <span class="knowledge-rank">重点 ${index + 1}</span>
          <strong>${point.title}</strong>
          <span class="knowledge-reason">${point.reason}</span>
          <span class="knowledge-evidence"><b>判断依据：</b>${point.evidence}</span>
          <span class="knowledge-goal"><b>训练目标：</b>${point.goal}</span>
          <span class="knowledge-action">进入两轮专项测试</span>
        </a>`,
    )
    .join("");
})();
