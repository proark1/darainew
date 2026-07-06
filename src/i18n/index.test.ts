import { describe, expect, it } from "vitest";
import { EN_TRANSLATIONS, loadTranslations, translate } from "./index";

describe("i18n registry", () => {
  it("translates from the loaded English fallback bundle", () => {
    expect(translate(EN_TRANSLATIONS, "common.save")).toBe("Save");
  });

  it("lazy-loads non-default locale bundles", async () => {
    const de = await loadTranslations("de");

    expect(de["common.save"]).toBe("Speichern");
  });

  it("hides unknown keys from the UI", () => {
    expect(translate(EN_TRANSLATIONS, "__missing.translation.key__")).toBe("");
  });
});
