import { useEffect, useMemo, useRef, useState } from "react";
import gates from "./data/gates.json";
import podcastVideos from "./data/podcastVideos.js";

const gateMeta = [
  ["الملخص التنفيذي", "الفكرة الكاملة: أين نقف اليوم، وإلى أين نصل."],
  ["التشخيص الرقمي", "تقييم الحسابات والموقع كما ورد في النسخة المرجعية."],
  ["الدورة التدريبية", "دورة صناعة المحتوى — 25 ساعة، 10 جلسات، بلا سينما."],
  ["البودكاست", "سبيك نيشن لايف — الإنتاج والتسعير والمقاطع."],
  ["السوشيال ميديا والموقع", "الباقات والتحليل وخطة المحتوى."],
  ["الهوية البصرية", "توحيد الهوية قبل الإطلاق — مشروع دفعة واحدة."],
  ["القيمة والخطة الزمنية", "القيمة المتوقعة وخطة التنفيذ خلال 90 يوماً."],
  ["المتابعة التشغيلية", "لوحة المتابعة: الحضور والصرف والمراسلات."],
];

const podcastMarker = "<!-- REACT_PODCAST_GALLERY -->";

function PodcastGallery() {
  const [selectedVideo, setSelectedVideo] = useState(0);
  const video = podcastVideos[selectedVideo];

  return (
    <section className="block podcast-library" aria-labelledby="podcast-library-title">
      <h3 className="h-sub" id="podcast-library-title">
        مكتبة فيديوهات البودكاست
      </h3>
      <p className="lead">
        اختر مقطعاً من القائمة لمشاهدته. عناوين المقاطع وأوصافها قابلة للتحرير
        من بيانات المكتبة.
      </p>
      <div className="podcast-current" aria-live="polite">
        <h4>{video.title}</h4>
        <p>{video.description}</p>
      </div>
      <div className="podcast-player">
        <iframe
          key={video.youtubeId}
          src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`}
          title={video.title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <div className="podcast-playlist" aria-label="اختيار مقطع فيديو">
        {podcastVideos.map((item, index) => (
          <button
            type="button"
            className="podcast-item"
            key={item.youtubeId}
            aria-pressed={selectedVideo === index}
            onClick={() => setSelectedVideo(index)}
          >
            <span className="podcast-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="podcast-item-copy">
              <strong>{item.title}</strong>
              <span>{item.description}</span>
              <small>فيديو على YouTube</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function GateContent({ gate }) {
  const gateHtml =
    gate.id === 3
      ? gate.html.replace(/<section class="block podcast-library"[\s\S]*?<\/section>/, "")
      : gate.html;
  const gallerySplit = gate.id === 3 ? gateHtml.split(podcastMarker) : null;

  if (!gallerySplit) {
    return (
      <article
        className="gate-content"
        data-g={gate.id}
        dangerouslySetInnerHTML={{ __html: gate.html }}
      />
    );
  }

  return (
    <article className="gate-content" data-g={gate.id}>
      <div dangerouslySetInnerHTML={{ __html: gallerySplit[0] }} />
      <PodcastGallery />
      <div dangerouslySetInnerHTML={{ __html: gallerySplit.slice(1).join(podcastMarker) }} />
    </article>
  );
}

function readOpsError(error) {
  return error instanceof Error ? error.message : "تعذّر إكمال العملية.";
}

function OperationsBridge() {
  useEffect(() => {
    let disposed = false;
    const cleanup = [];
    const listeners = [];
    const today = new Date().toISOString().slice(0, 10);
    ["#attFormEl [name='date']", "#expFormEl [name='date']"].forEach((selector) => {
      const input = document.querySelector(selector);
      if (input) input.value = today;
    });

    const flash = (id, text, ok = false) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.textContent = text;
      element.classList.toggle("ok", ok);
      if (ok) {
        window.setTimeout(() => {
          if (element.textContent === text) element.textContent = "";
        }, 3000);
      }
    };

    const escapeHtml = (value) =>
      String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]);

    const showUnavailable = (message) => {
      ["attList", "expList", "msgList"].forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.textContent = message;
      });
    };

    const subscribe = (query, id, row, options = {}) => {
      const element = document.getElementById(id);
      if (!element) return;
      const unsubscribe = query.onSnapshot(
        (snapshot) => {
          if (disposed) return;
          if (snapshot.empty) {
            element.innerHTML = '<p class="lead">لا سجلات بعد — أول إدخال سيظهر هنا.</p>';
            options.after?.([]);
            return;
          }
          const documents = snapshot.docs.map((documentSnapshot) => documentSnapshot.data());
          const rows = snapshot.docs.map((documentSnapshot) => row(documentSnapshot.data()));
          element.innerHTML = options.table
            ? `<div class="tw"><table>${options.header}<tbody>${rows.join("")}</tbody></table></div>`
            : rows.join("");
          options.after?.(documents);
        },
        () => {
          if (!disposed) {
            element.innerHTML = '<p class="lead">تعذّر الاتصال بقاعدة البيانات في هذا العرض.</p>';
          }
        },
      );
      if (typeof unsubscribe === "function") cleanup.push(unsubscribe);
    };

    const init = async () => {
      const claudeApi = window.claude;
      if (!claudeApi?.use) {
        showUnavailable("هذه اللوحة تعمل داخل عارض الوثيقة الذي يدعم التخزين الحي.");
        return;
      }

      try {
        const db = await claudeApi.use("db");
        const user = await claudeApi.use("user");
        const isAdmin = user ? await user.canEdit() : false;
        if (disposed) return;

        const expenseForm = document.getElementById("expFormWrap");
        if (!isAdmin && expenseForm) {
          expenseForm.innerHTML =
            '<p class="lead">تسجيل الصرف المالي متاح لمن يملك صلاحية Editor على هذه الوثيقة. السجل أدناه متاح للجميع للاطلاع.</p>';
        }
        if (!db) {
          showUnavailable("تعذّر الوصول لقاعدة البيانات — افتح هذه الوثيقة موقَّعاً للدخول.");
          return;
        }

        const attendanceForm = document.getElementById("attFormEl");
        if (attendanceForm) {
          const handler = async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = new FormData(form);
            try {
              await db.collection("attendance").add({
                name: String(values.get("name") || "").slice(0, 80),
                role: values.get("role") || "",
                mode: values.get("mode") || "",
                status: values.get("status") || "",
                date: values.get("date") || "",
                at: Date.now(),
              });
              form.reset();
              const date = form.querySelector('[name="date"]');
              if (date) date.value = today;
              flash("attMsg", "تم الحفظ.", true);
            } catch (error) {
              flash("attMsg", readOpsError(error));
            }
          };
          attendanceForm.addEventListener("submit", handler);
          listeners.push(() => attendanceForm.removeEventListener("submit", handler));
        }

        subscribe(
          db.collection("attendance").orderBy("at", "desc").limit(25),
          "attList",
          (data) =>
            `<tr><td>${escapeHtml(data.name)}</td><td class="mono">${escapeHtml(data.role)}</td><td class="mono">${escapeHtml(data.mode)}</td><td class="mono">${escapeHtml(data.status)}</td><td class="mono">${escapeHtml(data.date)}</td></tr>`,
          {
            table: true,
            header: "<thead><tr><th>الاسم</th><th>الصفة</th><th>النوع</th><th>الحالة</th><th>التاريخ</th></tr></thead>",
          },
        );

        const expenseFormEl = document.getElementById("expFormEl");
        if (expenseFormEl) {
          const handler = async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = new FormData(form);
            try {
              await db.collection("expenses").add({
                category: String(values.get("category") || "").slice(0, 60),
                amount: Number(values.get("amount")) || 0,
                desc: String(values.get("desc") || "").slice(0, 140),
                date: values.get("date") || "",
                at: Date.now(),
              });
              form.reset();
              const date = form.querySelector('[name="date"]');
              if (date) date.value = today;
              flash("expMsg", "تم الحفظ.", true);
            } catch (error) {
              flash("expMsg", readOpsError(error));
            }
          };
          expenseFormEl.addEventListener("submit", handler);
          listeners.push(() => expenseFormEl.removeEventListener("submit", handler));
        }

        subscribe(
          db.collection("expenses").orderBy("at", "desc").limit(50),
          "expList",
          (data) =>
            `<tr><td>${escapeHtml(data.category)}</td><td class="mono">${(Number(data.amount) || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td><td>${escapeHtml(data.desc)}</td><td class="mono">${escapeHtml(data.date)}</td></tr>`,
          {
            table: true,
            header: "<thead><tr><th>البند</th><th>المبلغ</th><th>الوصف</th><th>التاريخ</th></tr></thead>",
            after: (documents) => {
              const total = documents.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
              const totalElement = document.getElementById("expTotal");
              if (totalElement) {
                totalElement.textContent =
                  total.toLocaleString("en-US", { minimumFractionDigits: 2 }) + " د.إ";
              }
            },
          },
        );

        const messageForm = document.getElementById("msgFormEl");
        if (messageForm) {
          const handler = async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = new FormData(form);
            const text = String(values.get("text") || "").trim();
            if (!text) return;
            try {
              await db.collection("messages").add({
                from: String(values.get("from") || "").slice(0, 60),
                text: text.slice(0, 500),
                at: Date.now(),
              });
              form.reset();
              flash("msgMsg", "تم الإرسال.", true);
            } catch (error) {
              flash("msgMsg", readOpsError(error));
            }
          };
          messageForm.addEventListener("submit", handler);
          listeners.push(() => messageForm.removeEventListener("submit", handler));
        }

        subscribe(
          db.collection("messages").orderBy("at", "desc").limit(40),
          "msgList",
          (data) =>
            `<div class="msg-row"><span class="who">${escapeHtml(data.from)}</span><span class="when">${new Date(Number(data.at) || 0).toLocaleDateString("ar-AE")}</span><div class="txt">${escapeHtml(data.text)}</div></div>`,
        );
      } catch (error) {
        showUnavailable(`تعذّر تهيئة لوحة المتابعة: ${readOpsError(error)}`);
      }
    };

    init();
    return () => {
      disposed = true;
      cleanup.forEach((unsubscribe) => unsubscribe());
      listeners.forEach((removeListener) => removeListener());
    };
  }, []);

  return null;
}

function App() {
  const [activeGate, setActiveGate] = useState(null);
  const [search, setSearch] = useState("");
  const portalBody = useRef(null);
  const visibleGates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return gateMeta.map((gate, index) => ({ gate, index }));
    return gateMeta
      .map((gate, index) => ({ gate, index }))
      .filter(({ gate, index }) =>
        `${gate[0]} ${gate[1]} GATE ${String(index).padStart(2, "0")}`
          .toLocaleLowerCase()
          .includes(query),
      );
  }, [search]);
  const gate = activeGate == null ? null : gates[activeGate];

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (activeGate == null) return;
      if (event.key === "Escape") setActiveGate(null);
      if (event.target instanceof HTMLElement && event.target.matches("input, textarea, select")) return;
      if (event.key === "ArrowLeft" && activeGate < gates.length - 1) {
        setActiveGate((current) => current + 1);
      }
      if (event.key === "ArrowRight" && activeGate > 0) {
        setActiveGate((current) => current - 1);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeGate]);

  useEffect(() => {
    if (portalBody.current) portalBody.current.scrollTop = 0;
  }, [activeGate]);

  useEffect(() => {
    if (activeGate !== 2) return undefined;
    const tabs = document.querySelectorAll(".trk-tab");
    const panels = document.querySelectorAll(".trk-panel");
    const handlers = [];
    tabs.forEach((tab) => {
      const handler = () => {
        const selected = tab.getAttribute("data-tr");
        tabs.forEach((item) => item.classList.toggle("on", item === tab));
        panels.forEach((panel) => {
          panel.hidden = panel.getAttribute("data-tr") !== selected;
        });
      };
      tab.addEventListener("click", handler);
      handlers.push(() => tab.removeEventListener("click", handler));
    });
    return () => handlers.forEach((remove) => remove());
  }, [activeGate]);

  return (
    <>
      <div className="topstrip" />
      <div className="glow-layer" aria-hidden="true" />
      <main className="wall" hidden={activeGate != null}>
        <div className="mesh">
          <header className="wrap hero">
            <div className="hero-top flex items-center justify-between gap-4">
              <div className="brand-plate">
                <img
                  src={`${import.meta.env.BASE_URL}brand/logo.png`}
                  alt="شعار معهد سبيك نيشن"
                  className="brand-mark"
                />
                <div className="brand-txt">
                  <div className="ar">معهد سبيك نيشن للغات</div>
                  <div className="en">SPEAK NATION INSTITUTE · ABU DHABI</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="doc-meta hidden text-left sm:block">
                  عرض إنتاج وتشغيل محتوى وإدارة إعلامية
                  <br />
                  لؤي بابكر صديق وفريق عمله — إخراج وإنتاج
                </p>
                <span className="g-eyebrow !mb-0">
                  <i />
                  نسخة كلود الكاملة
                </span>
              </div>
            </div>

            <div className="hero-grid">
              <div>
                <span className="g-eyebrow">
                  <i />
                  استوديو سبيك نيشن
                </span>
                <h1>
                  نملك القدرة على تحويل المعهد إلى{" "}
                  <span className="grad">جهة منافسة قوية</span>
                </h1>
                <p className="lede">
                  ليس ببدء من الصفر — بإدارة محتوى قوية وجاذبة تستثمر ما هو موجود
                  فعلاً. ثماني بوابات تشرح التشخيص والحل الكامل وخطة التشغيل.
                </p>
                <div className="hero-stats">
                  <div>
                    <div className="v mono">10.8<small>K متابع إنستغرام</small></div>
                    <div className="k">الأقوى اليوم — راكد المحتوى</div>
                  </div>
                  <div>
                    <div className="v mono">32<small>مشترك / 46 فيديو</small></div>
                    <div className="k">يوتيوب: إنتاج عالٍ، تحويل ضعيف</div>
                  </div>
                  <div>
                    <div className="v mono">4<small>أشهر صمت بالمدونة</small></div>
                    <div className="k">فرصة SEO تُفقد شهرياً</div>
                  </div>
                  <div>
                    <div className="v mono">3<small>عناصر حل متكاملة</small></div>
                    <div className="k">أكاديمية، بودكاست، سوشيال ميديا</div>
                  </div>
                </div>
              </div>
              <div className="hero-photo">
                <img
                  src={`${import.meta.env.BASE_URL}media/hero-team.jpg`}
                  alt="فريق يعمل على المحتوى"
                />
              </div>
            </div>
          </header>
        </div>

        <section className="wrap pb-10 pt-8" aria-labelledby="gates-title">
          <div className="gates-head">
            <h2 id="gates-title">ثماني بوابات</h2>
            <p>افتح أي بوابة لقراءة محتواها الكامل من نسخة كلود.</p>
          </div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <label className="search-control flex items-center gap-3 rounded-xl border border-[var(--line-2)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink-2)] focus-within:border-[var(--accent)]">
              <span aria-hidden="true">⌕</span>
              <input
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--ink-3)]"
                type="search"
                placeholder="ابحث في البوابات..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <span className="pill gold">{visibleGates.length} بوابة</span>
          </div>
          <div className="gate-grid">
            {visibleGates.map(({ gate: meta, index }) => (
              <button
                className="gate-card text-right"
                key={index}
                type="button"
                style={{ "--gi": index }}
                onClick={() => setActiveGate(index)}
              >
                <span className="gc-top">
                  <span className="gc-n">GATE {String(index).padStart(2, "0")}</span>
                  <span className="gc-ico bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-[var(--on-accent)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </span>
                <span className="block text-lg font-extrabold text-[var(--ink)]">{meta[0]}</span>
                <span className="block text-sm leading-7 text-[var(--ink-2)]">{meta[1]}</span>
                <span className="gc-go">
                  افتح البوابة
                  <span aria-hidden="true">←</span>
                </span>
              </button>
            ))}
            {visibleGates.length === 0 && (
              <p className="card col-span-full text-[var(--ink-2)]">لا توجد بوابة بهذا الاسم.</p>
            )}
          </div>
        </section>

        <footer className="wfoot">
          <div className="wrap">
            <p className="foot-name">لؤي بابكر صديق وفريق عمله — إخراج وإنتاج</p>
            <div className="foot-contact">
              <a className="fc-item" href="https://wa.me/971585410334" target="_blank" rel="noopener noreferrer">
                <bdi dir="ltr">+971 58 541 0334</bdi>
              </a>
              <a className="fc-item" href="mailto:luaisiddig@gmail.com">
                <bdi dir="ltr">luaisiddig@gmail.com</bdi>
              </a>
              <a className="fc-item" href="https://luai-babiker.netlify.app" target="_blank" rel="noopener noreferrer">
                <bdi dir="ltr">luai-babiker.netlify.app</bdi>
              </a>
            </div>
          </div>
        </footer>
      </main>

      {gate && (
        <div
          className="portal in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="portalTitle"
        >
          <div className="portal-bar">
            <button className="p-back" type="button" onClick={() => setActiveGate(null)}>
              <span aria-hidden="true">←</span>
              <span>كل البوابات</span>
            </button>
            <div>
              <div className="p-title" id="portalTitle">{gateMeta[activeGate][0]}</div>
              <div className="p-idx mono">GATE {String(activeGate).padStart(2, "0")}</div>
            </div>
            <div className="p-right" aria-label="اختيار بوابة">
              <div className="pdots">
                {gates.map((item, index) => (
                  <button
                    className={`pdot${index === activeGate ? " on" : ""}`}
                    type="button"
                    key={item.id}
                    aria-label={`بوابة ${index + 1}: ${gateMeta[index][0]}`}
                    aria-current={index === activeGate ? "step" : undefined}
                    onClick={() => setActiveGate(index)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="portal-body" ref={portalBody}>
            <GateContent gate={gate} />
            {activeGate === 7 && <OperationsBridge key="operations-bridge" />}
          </div>
          <div className="portal-foot">
            <button
              className="nv-btn"
              type="button"
              disabled={activeGate === 0}
              onClick={() => setActiveGate((current) => Math.max(0, current - 1))}
            >
              <span aria-hidden="true">→</span>
              <span>السابقة</span>
            </button>
            <button
              className="nv-btn primary"
              type="button"
              disabled={activeGate === gates.length - 1}
              onClick={() => setActiveGate((current) => Math.min(gates.length - 1, current + 1))}
            >
              <span>التالية</span>
              <span aria-hidden="true">←</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
