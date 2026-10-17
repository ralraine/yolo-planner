
"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  Plus,
  X,
  Check,
  LoaderCircle,
  BookOpen,
  Hash,
} from "lucide-react";

type Subject = {
  id: string;
  name: string;
  code: string | null;
  color: string;
  created_at: string;
};

const colors = [
  "#E7A1C8",
  "#8BBCEC",
  "#B5A3E6",
  "#E8BF7F",
  "#91CDB0",
  "#DAA4A7",
];

export default function SubjectManager() {
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState("#E7A1C8");

  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");

  // LOAD SUBJECTS FROM DATABASE
  useEffect(() => {
    const controller = new AbortController();

    async function loadSubjects() {
      try {
        const response = await fetch("/api/subjects", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load subjects."
          );
        }

        setSubjects(result.subjects ?? []);
        setLoadError("");
      } catch (error) {
        if (controller.signal.aborted) return;

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load subjects."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadSubjects();

    return () => controller.abort();
  }, []);

  function openModal() {
    setName("");
    setCode("");
    setColor("#E7A1C8");
    setFormError("");
    setIsOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setIsOpen(false);
    setFormError("");
  }

  // SAVE NEW SUBJECT
  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    setFormError("");

    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanName) {
      setFormError("Please enter a subject name.");
      return;
    }

    if (
      !/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(cleanCode)
    ) {
      setFormError(
        "Please enter a valid subject code (2–20 characters)."
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/subjects", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
          code: cleanCode,
          color,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to save subject."
        );
      }

      // ADD NEW SUBJECT TO SIDEBAR
      setSubjects((previous) => [
        ...previous,
        result.subject,
      ]);

      setIsOpen(false);
      setName("");
      setCode("");
      setColor("#E7A1C8");
      setFormError("");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* SIDEBAR SUBJECTS */}
      <div className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            My Subjects
          </p>

          <button
            type="button"
            onClick={openModal}
            aria-label="Add Subject"
            title="Add Subject"
            className="rounded-lg p-1.5 text-[#d487b5] transition hover:bg-pink-50"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* SAVED SUBJECTS */}
        <div className="space-y-1">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-400">
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
              Loading subjects...
            </div>
          ) : subjects.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-400">
              No subjects yet.
            </p>
          ) : (
            subjects.map((subject) => (
              <div
                key={subject.id}
                className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#f9f6fc]"
              >
                {/* SUBJECT COLOR */}
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor: subject.color,
                  }}
                />

                {/* SUBJECT NAME + CODE */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#34364d]">
                    {subject.name}
                  </p>

                  <p className="mt-0.5 truncate text-xs text-gray-400">
                    {subject.code || "No code yet"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ADD BUTTON */}
        <button
          type="button"
          onClick={openModal}
          className="mt-4 flex w-full items-center gap-2 rounded-xl border border-dashed border-pink-200 px-3 py-3 text-sm font-medium text-[#d487b5] transition hover:bg-pink-50"
        >
          <Plus size={17} />
          Add Subject
        </button>

        {loadError && (
          <p
            role="alert"
            className="mt-3 text-xs text-red-500"
          >
            {loadError}
          </p>
        )}
      </div>

      {/* ADD SUBJECT POPUP */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#25253a]/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subject-modal-title"
            className="my-auto w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl"
          >
            {/* MODAL HEADER */}
            <div className="mb-7 flex items-start justify-between">
              <div>
                <h2
                  id="subject-modal-title"
                  className="text-xl font-bold text-[#34364d]"
                >
                  Add New Subject
                </h2>

                <p className="mt-2 text-sm text-gray-400">
                  Organize your academic workspace.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                aria-label="Close"
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="space-y-5"
            >
              {/* SUBJECT NAME */}
              <div>
                <label
                  htmlFor="subjectName"
                  className="mb-2 block text-sm font-medium text-gray-600"
                >
                  Subject Name
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 focus-within:border-pink-300">
                  <BookOpen
                    size={18}
                    className="shrink-0 text-gray-400"
                  />

                  <input
                    id="subjectName"
                    type="text"
                    required
                    maxLength={60}
                    autoFocus
                    placeholder="e.g. Foundations of Data Analytics"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    className="min-w-0 w-full bg-transparent py-3.5 text-sm text-[#34364d] outline-none"
                  />
                </div>
              </div>

              {/* SUBJECT CODE */}
              <div>
                <label
                  htmlFor="subjectCode"
                  className="mb-2 block text-sm font-medium text-gray-600"
                >
                  Subject Code
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 focus-within:border-pink-300">
                  <Hash
                    size={18}
                    className="shrink-0 text-gray-400"
                  />

                  <input
                    id="subjectCode"
                    type="text"
                    required
                    minLength={2}
                    maxLength={20}
                    placeholder="e.g. CS0073"
                    value={code}
                    onChange={(e) => {
                      const value = e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9_-]/g, "")
                        .slice(0, 20);

                      setCode(value);
                    }}
                    className="min-w-0 w-full bg-transparent py-3.5 text-sm font-medium uppercase tracking-wide text-[#34364d] outline-none"
                  />
                </div>

                <p className="mt-2 text-xs text-gray-400">
                  Enter your course or subject code.
                </p>
              </div>

              {/* COLOR PICKER */}
              <div>
                <p className="mb-3 text-sm font-medium text-gray-600">
                  Choose a Color
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  {colors.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-label={`Select ${option}`}
                      aria-pressed={color === option}
                      onClick={() => setColor(option)}
                      className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                        color === option
                          ? "ring-2 ring-gray-400 ring-offset-2"
                          : "hover:scale-110"
                      }`}
                      style={{
                        backgroundColor: option,
                      }}
                    >
                      {color === option && (
                        <Check
                          size={18}
                          className="text-[#34364d]"
                        />
                      )}
                    </button>
                  ))}

                  <input
                    type="color"
                    aria-label="Choose custom subject color"
                    title="Custom Color"
                    value={color}
                    onChange={(e) =>
                      setColor(e.target.value)
                    }
                    className="h-10 w-10 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  />
                </div>
              </div>

              {/* SUBJECT PREVIEW */}
              <div className="rounded-xl bg-[#f8f8fd] p-4">
                <p className="mb-3 text-xs text-gray-400">
                  Preview
                </p>

                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: color,
                    }}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-[#34364d]">
                      {name || "Subject Name"}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      {code || "SUBJECT CODE"}
                    </p>
                  </div>
                </div>
              </div>

              {/* ERROR MESSAGE */}
              {formError && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-600"
                >
                  {formError}
                </p>
              )}

              {/* ACTION BUTTONS */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeModal}
                  className="rounded-xl px-5 py-3 text-sm font-medium text-gray-500 hover:bg-gray-100"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-[#dc83b6] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ca73a6] disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <LoaderCircle
                        size={17}
                        className="animate-spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      Save Subject
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
