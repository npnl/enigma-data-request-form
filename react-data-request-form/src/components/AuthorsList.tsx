import React, { useState, useEffect } from "react";
import { Form, Button, Alert } from "react-bootstrap";
import { styled } from "styled-components";
import TextareaAutosize from "@mui/material/TextareaAutosize";
import ApiUtils from "../api/ApiUtils";
import { getCurrentUserToken } from "../services/authService";

interface PI {
  first_name: string;
  last_name: string;
  MI: string;
  primary_email: string;
  cohort_enigma_list: string[];
  orcid?: string;
  department_list?: string[];
  university_list?: string[];
  city_list?: string[];
  state_list?: string[];
  country_list?: string[];
  affiliations?: string[]; // pre-joined affiliation strings (from CSV upload)
  cohort_funding?: Array<{
    cohort: string;
    acknowledgements?: Array<{ grant_source: string; ref_id: string }>;
    funding?: string;
  }>;
  disclosures?: string[]; 
}

const StyledTextarea = styled(TextareaAutosize)({
  width: "100%",
  padding: "8px",
  border: "1px solid #ccc",
  borderRadius: "4px",
  resize: "none",
  fontFamily: "monospace",
  fontSize: "14px",
});

const toSup = (n: number): string => {
  const map: Record<string, string> = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
  return String(n).split('').map(d => map[d] || d).join('');
};

const AuthorsList = () => {
  const [siteInput, setSiteInput] = useState<string>("");
  const [piList, setPiList] = useState<PI[]>([]);
  const [allPIs, setAllPIs] = useState<PI[]>([]);
  const [formattedResponse, setFormattedResponse] = useState<string>("");
  const [nameFormatOption, setNameFormatOption] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [includeOrcid, setIncludeOrcid] = useState<boolean>(false);
  const [includeAffiliations, setIncludeAffiliations] = useState<boolean>(false);
  const [affiliationJoined, setAffiliationJoined] = useState<boolean>(true);
  const [uploadMode, setUploadMode] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [csvPreviewMode, setCsvPreviewMode] = useState<"single" | "multiple">("single");
  const [columnsCopied, setColumnsCopied] = useState<boolean>(false);
  const [affiliationStyle, setAffiliationStyle] = useState<"bracket" | "superscript">("bracket");
  const [htmlResponse, setHtmlResponse] = useState<string>("");
  const [wordCopied, setWordCopied] = useState<boolean>(false);
  const [fundingAckResponse, setFundingAckResponse] = useState<string>("");
  const [searchedSites, setSearchedSites] = useState<string[]>([]);
  const [disclosuresResponse, setDisclosuresResponse] = useState<string>("");
  const [fundingCopied, setFundingCopied] = useState<boolean>(false);
  const [disclosuresCopied, setDisclosuresCopied] = useState<boolean>(false);


  useEffect(() => {
    const fetchPIs = async () => {
      try {
        setLoading(true);
        const token = await getCurrentUserToken();
        const collaborators = await ApiUtils.fetchCollaborators(token);
        

        const pis = collaborators.filter((c: any) => c.role === "PI");
        setAllPIs(pis);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching PIs:", err);
        setError("Failed to load PI data");
        setLoading(false);
      }
    };

    fetchPIs();
  }, []);


  const handleSiteSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchBySite();
    }
  };

  const searchBySite = () => {
    if (!siteInput.trim()) {
      setError("Please enter a site name");
      return;
    }

    setError("");
    setUploadMode(false);
    const sites = siteInput.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s);

    if (sites.length === 0) {
      setError("Please enter valid site names");
      return;
    }

    setSearchedSites(sites);

    // Filter PIs by cohort_enigma_list (site)
    const matchingPIs = allPIs.filter((pi) => {
      const cohorts = pi.cohort_enigma_list || [];
      return cohorts.some((cohort) => sites.some((site) => cohort.toLowerCase().includes(site)));
    });

    if (matchingPIs.length === 0) {
      setError(`No PIs found for site: ${siteInput}`);
      setPiList([]);
      setFormattedResponse("");
      setFundingAckResponse("");
      setDisclosuresResponse("");
    } else {
      setPiList(matchingPIs);
      formatAuthors(matchingPIs);
      formatFundingAck(matchingPIs, sites);
      formatDisclosures(matchingPIs);
    }
  };

  //CSV Upload

  const parseCSVText = (text: string): { headers: string[]; rows: string[][] } => {
    const result: string[][] = [];
    let i = 0;
    const len = text.length;

    while (i < len) {
      const row: string[] = [];

      while (i < len) {
        if (text[i] === '"') {
          i++; // skip opening quote
          let field = "";
          while (i < len) {
            if (text[i] === '"') {
              if (i + 1 < len && text[i + 1] === '"') {
                field += '"';
                i += 2;
              } else {
                i++; 
                break;
              }
            } else {
              field += text[i++];
            }
          }
          row.push(field);
        } else {
          let field = "";
          while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
            field += text[i++];
          }
          row.push(field.trim());
        }

        if (i < len && text[i] === ",") {
          i++; 
        } else {
          break; 
        }
      }

      if (i < len && text[i] === "\r") i++;
      if (i < len && text[i] === "\n") i++;

      if (row.length > 0 && !(row.length === 1 && row[0] === "")) {
        result.push(row);
      }
    }

    if (result.length === 0) return { headers: [], rows: [] };
    return { headers: result[0], rows: result.slice(1) };
  };

  const convertCSVToPIs = (headers: string[], rows: string[][]): PI[] => {
    const norm = (h: string) => h.trim().toLowerCase().replace(/\s+/g, "_");

    const findCol = (...names: string[]): number => {
      for (const n of names) {
        const idx = headers.findIndex((h) => norm(h) === n);
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const firstNameIdx = findCol("first_name", "firstname", "first name");
    const lastNameIdx  = findCol("last_name", "lastname", "last name");
    const miIdx        = findCol("mi", "m.i.", "middle_initial", "middle_name");
    const emailIdx     = findCol("email", "primary_email", "e-mail");
    const orcidIdx     = findCol("orcid");
    const siteIdx      = findCol("site", "bids_site", "site_id");
    const singleAffIdx = findCol("affiliation", "institution", "affiliation_text");

    // AFFILIATION_N joined columns (but NOT AFFILIATION_N_FIELD)
    const joinedAffCols: { n: number; idx: number }[] = [];
    headers.forEach((h, i) => {
      if (/^affiliation_\d+$/i.test(h.trim()))
        joinedAffCols.push({ n: parseInt(h.trim().match(/\d+/)![0]), idx: i });
    });
    joinedAffCols.sort((a, b) => a.n - b.n);

    // AFFILIATION_N_FIELD separate columns
    const separateAffCols: { n: number; field: string; idx: number }[] = [];
    headers.forEach((h, i) => {
      const m = h.trim().match(/^affiliation_(\d+)_(department|institution|city|state_region|state|country)$/i);
      if (m) separateAffCols.push({ n: parseInt(m[1]), field: m[2].toLowerCase(), idx: i });
    });

    const getVal = (row: string[], idx: number) =>
      idx >= 0 && idx < row.length ? row[idx].trim() : "";

    // GRANT_SOURCE_N and REF_ID_N columns
    const grantSourceCols: { n: number; idx: number }[] = [];
    const refIdCols: { n: number; idx: number }[] = [];
    headers.forEach((h, i) => {
      const m1 = h.trim().match(/^grant_source_(\d+)$/i);
      if (m1) grantSourceCols.push({ n: parseInt(m1[1]), idx: i });
      const m2 = h.trim().match(/^ref_id_(\d+)$/i);
      if (m2) refIdCols.push({ n: parseInt(m2[1]), idx: i });
    });

    // DISCLOSURE_CATEGORY_N and DISCLOSURE_ENTITY_N columns
    const discCatCols: { n: number; idx: number }[] = [];
    const discEntityCols: { n: number; idx: number }[] = [];
    headers.forEach((h, i) => {
      const m1 = h.trim().match(/^disclosure_category_(\d+)$/i);
      if (m1) discCatCols.push({ n: parseInt(m1[1]), idx: i });
      const m2 = h.trim().match(/^disclosure_entity_(\d+)$/i);
      if (m2) discEntityCols.push({ n: parseInt(m2[1]), idx: i });
    });

    const piMap = new Map<string, { pi: PI; affiliations: string[] }>();

    rows.forEach((row) => {
      if (row.every((c) => !c)) return;

      const email     = getVal(row, emailIdx);
      const firstName = getVal(row, firstNameIdx);
      const lastName  = getVal(row, lastNameIdx);
      const mi        = getVal(row, miIdx);
      const orcid     = getVal(row, orcidIdx);
      const site      = getVal(row, siteIdx);

      if (!firstName && !lastName && !email) return;

      const key = email || `${firstName}|${lastName}|${mi}`;
      let entry = piMap.get(key);
      if (!entry) {
        // Build funding entries from GRANT_SOURCE_N / REF_ID_N columns
        const maxGrantN = Math.max(0, ...grantSourceCols.map((c) => c.n), ...refIdCols.map((c) => c.n));
        const acks: Array<{ grant_source: string; ref_id: string }> = [];
        for (let n = 1; n <= maxGrantN; n++) {
          const gsIdx = grantSourceCols.find((c) => c.n === n)?.idx ?? -1;
          const riIdx = refIdCols.find((c) => c.n === n)?.idx ?? -1;
          const gs = getVal(row, gsIdx);
          const ri = getVal(row, riIdx);
          if (gs || ri) acks.push({ grant_source: gs, ref_id: ri });
        }

        // Build disclosure entries from DISCLOSURE_CATEGORY_N / DISCLOSURE_ENTITY_N columns
        const maxDiscN = Math.max(0, ...discCatCols.map((c) => c.n), ...discEntityCols.map((c) => c.n));
        const disclosures: string[] = [];
        for (let n = 1; n <= maxDiscN; n++) {
          const catIdx = discCatCols.find((c) => c.n === n)?.idx ?? -1;
          const entIdx = discEntityCols.find((c) => c.n === n)?.idx ?? -1;
          const cat = getVal(row, catIdx);
          const entity = getVal(row, entIdx);
          if (cat) disclosures.push(JSON.stringify({ category: cat, details: entity }));
        }

        entry = {
          pi: {
            first_name: firstName,
            last_name: lastName,
            MI: mi,
            primary_email: email,
            cohort_enigma_list: site ? [site] : [],
            orcid: orcid || undefined,
            cohort_funding: acks.length > 0 ? [{ cohort: site, acknowledgements: acks }] : undefined,
            disclosures: disclosures.length > 0 ? disclosures : undefined,
          },
          affiliations: [],
        };
        piMap.set(key, entry);
      }

      const addAff = (text: string) => {
        const t = text.trim();
        if (t && !entry!.affiliations.includes(t)) entry!.affiliations.push(t);
      };

      if (joinedAffCols.length > 0) {
        joinedAffCols.forEach(({ idx }) => addAff(getVal(row, idx)));
      } else if (separateAffCols.length > 0) {
        const maxN = Math.max(...separateAffCols.map((c) => c.n));
        for (let n = 1; n <= maxN; n++) {
          const parts = separateAffCols
            .filter((c) => c.n === n)
            .sort((a, b) => a.idx - b.idx)
            .map(({ idx }) => getVal(row, idx))
            .filter((v) => v);
          if (parts.length > 0) addAff(parts.join(", "));
        }
      } else if (singleAffIdx >= 0) {
        addAff(getVal(row, singleAffIdx));
      }
    });

    return Array.from(piMap.values()).map(({ pi, affiliations }) => ({
      ...pi,
      affiliations: affiliations.length > 0 ? affiliations : undefined,
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const { headers, rows } = parseCSVText(text);

        if (headers.length === 0) {
          setUploadError("Could not parse CSV — file appears to be empty.");
          return;
        }

        const pis = convertCSVToPIs(headers, rows);
        if (pis.length === 0) {
          setUploadError("No valid author rows found in the CSV.");
          return;
        }

        setUploadMode(true);
        setError("");
        setPiList(pis);
        formatAuthors(pis);
      } catch (err) {
        setUploadError("Failed to parse CSV. Please check the file format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const formatAuthors = (pis: PI[]) => {
    const seen = new Set<string>();
    const uniquePIs = pis
      .filter((pi) => {
        if (seen.has(pi.primary_email)) return false;
        seen.add(pi.primary_email);
        return true;
      })
      .sort((a, b) => a.last_name.localeCompare(b.last_name));

    const affiliationMap = new Map<string, number>();
    let affiliationCounter = 0;
    const getAffiliationNumber = (text: string): number => {
      if (!affiliationMap.has(text)) {
        affiliationCounter++;
        affiliationMap.set(text, affiliationCounter);
      }
      return affiliationMap.get(text)!;
    };

    const authorEntries = uniquePIs.map((pi) => {
      const firstName = pi.first_name || "";
      const lastName = pi.last_name || "";
      const mi = pi.MI || "";

      let name = "";
      switch (nameFormatOption) {
        case 1: {
          const firstInitials = firstName.split(/[\s-]+/).map((n) => n.charAt(0).toUpperCase()).join(".-");
          const lastInitial = lastName.charAt(0).toUpperCase();
          name = mi
            ? `${firstInitials}.-${mi.charAt(0).toUpperCase()}.${lastInitial}.`
            : `${firstInitials}.${lastInitial}.`;
          break;
        }
        case 2:
          name = mi ? `${firstName} ${mi}. ${lastName}` : `${firstName} ${lastName}`;
          break;
        case 3: {
          const initials = firstName.split(/[\s-]+/).map((n) => n.charAt(0).toUpperCase()).join(".-");
          name = mi
            ? `${initials}. ${mi.charAt(0).toUpperCase()}. ${lastName}`
            : `${initials}. ${lastName}`;
          break;
        }
        default:
          name = `${firstName} ${lastName}`;
      }

      const affNums: number[] = [];
      if (pi.affiliations && pi.affiliations.length > 0) {

        pi.affiliations.forEach((text) => {
          if (text) affNums.push(getAffiliationNumber(text));
        });
      } else {

        const maxLen = Math.max(
          pi.department_list?.length || 0,
          pi.university_list?.length || 0,
          pi.city_list?.length || 0,
          pi.state_list?.length || 0,
          pi.country_list?.length || 0
        );
        for (let i = 0; i < maxLen; i++) {
          const parts = [
            pi.department_list?.[i] || "",
            pi.university_list?.[i] || "",
            pi.city_list?.[i] || "",
            pi.state_list?.[i] || "",
            pi.country_list?.[i] || "",
          ].filter((p) => p);
          const text = parts.join(", ");
          if (text) affNums.push(getAffiliationNumber(text));
        }
      }

      let plainSuffix = "";
      if (affNums.length > 0) {
        if (affiliationStyle === "bracket") {
          plainSuffix = " " + affNums.map(n => `[${n}]`).join("");
        } else {
          plainSuffix = affNums.map(n => toSup(n)).join("");
        }
      }
      const htmlSuffix = affNums.length > 0 ? `<sup>${affNums.join(",")}</sup>` : "";

      return { plain: `${name}${plainSuffix}`, html: `${name}${htmlSuffix}` };
    });


    const orderedAff: { num: number; text: string }[] = [];
    affiliationMap.forEach((num, text) => orderedAff.push({ num, text }));
    orderedAff.sort((a, b) => a.num - b.num);

    const affiliationLines = orderedAff.map(({ num, text }) =>
      affiliationStyle === "bracket" ? `[${num}] ${text}` : `${toSup(num)} ${text}`
    );
    const affiliationHtmlLines = orderedAff.map(({ num, text }) => `<sup>${num}</sup> ${text}`);

    const formatted =
      authorEntries.map(e => e.plain).join(", ") +
      (affiliationLines.length > 0 ? "\n\n" + affiliationLines.join("\n") : "");

    const html =
      `<p style="font-family:serif">${authorEntries.map(e => e.html).join(", ")}</p>` +
      (affiliationHtmlLines.length > 0
        ? `<p style="font-family:serif">${affiliationHtmlLines.join("<br>")}</p>`
        : "");

    setFormattedResponse(formatted);
    setHtmlResponse(html);
  };

  const buildFundingText = (name: string, acks: Array<{ grant_source: string; ref_id: string }>): string => {
    // Group by grant_source, collecting unique non-empty ref_ids per source
    const grantObj: { [grant: string]: string[] } = {};
    acks.forEach((ack) => {
      const grant = ack.grant_source.trim();
      if (!grant) return;
      if (!grantObj[grant]) grantObj[grant] = [];
      const ref = ack.ref_id.trim();
      if (ref && grantObj[grant].indexOf(ref) === -1) grantObj[grant].push(ref);
    });

    const grantKeys = Object.keys(grantObj);
    if (grantKeys.length === 0) return `${name} does not have any funding acknowledgements.`;

    // Group grant sources that share the exact same ref_id set so they can be
    // rendered as "grantA and grantB (ref)" instead of "grantA (ref) and grantB (ref)"
    const refKeyToGrants: { [refKey: string]: string[] } = {};
    grantKeys.forEach((grant) => {
      const refKey = grantObj[grant].slice().sort().join("|");
      if (!refKeyToGrants[refKey]) refKeyToGrants[refKey] = [];
      refKeyToGrants[refKey].push(grant);
    });

    const parts: string[] = Object.keys(refKeyToGrants).map((refKey) => {
      const refs = refKey ? refKey.split("|") : [];
      const grantText = refKeyToGrants[refKey].join(" and ");
      const refText = refs.length > 0 ? ` (${refs.join("; ")})` : "";
      return `${grantText}${refText}`;
    });

    return `${name} is supported by ${parts.join(" and ")}.`;
  };

  const formatFundingAck = (pis: PI[], sites: string[]) => {
    const seen = new Set<string>();
    const uniquePIs = pis
      .filter((pi) => {
        if (seen.has(pi.primary_email)) return false;
        seen.add(pi.primary_email);
        return true;
      })
      .sort((a, b) => a.last_name.localeCompare(b.last_name));

    const lines = uniquePIs.map((pi) => {
      const firstName = pi.first_name || "";
      const lastName = pi.last_name || "";
      const mi = pi.MI || "";

      let name = "";
      switch (nameFormatOption) {
        case 1: {
          const firstInitials = firstName.split(/[\s-]+/).map((n) => n.charAt(0).toUpperCase()).join(".-");
          const lastInitial = lastName.charAt(0).toUpperCase();
          name = mi
            ? `${firstInitials}.-${mi.charAt(0).toUpperCase()}.${lastInitial}.`
            : `${firstInitials}.${lastInitial}.`;
          break;
        }
        case 2:
          name = mi ? `${firstName} ${mi}. ${lastName}` : `${firstName} ${lastName}`;
          break;
        case 3: {
          const initials = firstName.split(/[\s-]+/).map((n) => n.charAt(0).toUpperCase()).join(".-");
          name = mi
            ? `${initials}. ${mi.charAt(0).toUpperCase()}. ${lastName}`
            : `${initials}. ${lastName}`;
          break;
        }
        default:
          name = `${firstName} ${lastName}`;
      }

      const matchedAcks: Array<{ grant_source: string; ref_id: string }> = [];
      if (pi.cohort_funding && Array.isArray(pi.cohort_funding)) {
        pi.cohort_funding.forEach((entry) => {
          const cohortLower = entry.cohort.toLowerCase();
          if (!sites.some((site) => cohortLower.includes(site))) return;

          if (Array.isArray(entry.acknowledgements)) {
            // New format
            entry.acknowledgements.forEach((ack) => {
              if (ack.grant_source.trim()) matchedAcks.push(ack);
            });
          } else if (entry.funding && entry.funding.trim()) {
            // Legacy "grant_source (ref_id)" string format
            const match = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(entry.funding.trim());
            if (match) {
              matchedAcks.push({ grant_source: match[1].trim(), ref_id: match[2].trim() });
            } else {
              matchedAcks.push({ grant_source: entry.funding.trim(), ref_id: "" });
            }
          }
        });
      }

      return buildFundingText(name, matchedAcks);
    });

    setFundingAckResponse(lines.join(" "));
  };

  const formatDisclosures = (pis: PI[]) => {
    const seen = new Set<string>();
    const uniquePIs = pis
      .filter((pi) => {
        if (seen.has(pi.primary_email)) return false;
        seen.add(pi.primary_email);
        return true;
      })
      .sort((a, b) => a.last_name.localeCompare(b.last_name));

    type Entry = { name: string; hasDisclosures: boolean; disclosureText: string };
    const entries: Entry[] = uniquePIs.map((pi) => {
      const firstName = pi.first_name || "";
      const lastName = pi.last_name || "";
      const mi = pi.MI || "";

      let name = "";
      switch (nameFormatOption) {
        case 1: {
          const firstInitials = firstName.split(/[\s-]+/).map((n) => n.charAt(0).toUpperCase()).join(".-");
          const lastInitial = lastName.charAt(0).toUpperCase();
          name = mi
            ? `${firstInitials}.-${mi.charAt(0).toUpperCase()}.${lastInitial}.`
            : `${firstInitials}.${lastInitial}.`;
          break;
        }
        case 2:
          name = mi ? `${firstName} ${mi}. ${lastName}` : `${firstName} ${lastName}`;
          break;
        case 3: {
          const initials = firstName.split(/[\s-]+/).map((n) => n.charAt(0).toUpperCase()).join(".-");
          name = mi
            ? `${initials}. ${mi.charAt(0).toUpperCase()}. ${lastName}`
            : `${initials}. ${lastName}`;
          break;
        }
        default:
          name = `${firstName} ${lastName}`;
      }

      const raw = (pi.disclosures || []).flat();
      const parsed: Array<{ category: string; details: string; patent_product?: string; patent_ref?: string; patent_institution?: string }> = [];
      raw.forEach((d: any) => {
        if (typeof d === "string" && d.trim()) {
          try {
            const obj = JSON.parse(d);
            if (obj.category && (obj.details || obj.patent_product || obj.patent_ref || obj.patent_institution)) {
              parsed.push(obj);
            }
          } catch {
            // skip malformed entries
          }
        }
      });
      const valid = parsed.filter((d) => {
        if (!d.category.trim()) return false;
        if (d.category === 'patents') return !!(d.patent_product || d.patent_ref || d.patent_institution);
        return d.details.trim();
      });

      // Group disclosures by category, preserving order of first appearance
      const categoryOrder: string[] = [];
      const grouped: Record<string, typeof valid> = {};
      for (const d of valid) {
        if (!grouped[d.category]) {
          grouped[d.category] = [];
          categoryOrder.push(d.category);
        }
        grouped[d.category].push(d);
      }

      const formatGroupSentence = (category: string, items: typeof valid): string => {
        switch (category) {
          case 'competing_interest': {
            const details = items.map(d => d.details).join('; ');
            return `${name} has competing interests in ${details}.`;
          }
          case 'funding_source': {
            const details = items.map(d => d.details).join('; ');
            return `${name} received research funding from ${details} for research unrelated to this manuscript.`;
          }
          case 'employment': {
            const details = items.map(d => d.details).join('; ');
            return `${name} is employed by ${details}.`;
          }
          case 'consulting': {
            const details = items.map(d => d.details).join('; ');
            return `${name} has received consultancy fees from or is a consultant for ${details}.`;
          }
          case 'stock_ownership': {
            const details = items.map(d => d.details).join('; ');
            return `${name} is a shareholder in ${details}.`;
          }
          case 'patents': {
            const patentDetails = items.map(d => {
              const parts: string[] = [];
              if (d.patent_product) parts.push(d.patent_product);
              const suffix: string[] = [];
              if (d.patent_ref) suffix.push(`Ref: ${d.patent_ref}`);
              if (d.patent_institution) suffix.push(d.patent_institution);
              return parts.join('') + (suffix.length > 0 ? ` (${suffix.join(', ')})` : '');
            }).join('; ');
            return `${name} holds patents for ${patentDetails}.`;
          }
          case 'advisory_leadership_roles': {
            const details = items.map(d => d.details).join('; ');
            return `${name} serves on the Advisory Board for ${details}.`;
          }
          case 'other':
            return items.map(d => `${name} ${d.details}`).join(' ');
          default: {
            const details = items.map(d => d.details).join('; ');
            return `${name} - ${details}`;
          }
        }
      };

      if (valid.length === 0) {
        return { name, hasDisclosures: false, disclosureText: "" };
      }
      const discText = categoryOrder.map(cat => formatGroupSentence(cat, grouped[cat])).join(" ");
      return { name, hasDisclosures: true, disclosureText: discText };
    });

    const lines: string[] = [];
    let i = 0;
    while (i < entries.length) {
      if (!entries[i].hasDisclosures) {
        const group: string[] = [];
        while (i < entries.length && !entries[i].hasDisclosures) {
          group.push(entries[i].name);
          i++;
        }
        if (group.length === 1) {
          lines.push(`${group[0]} reports no disclosures relevant to the manuscript.`);
        } else if (group.length === 2) {
          lines.push(`${group[0]} and ${group[1]} report no disclosures relevant to the manuscript.`);
        } else {
          const allButLast = group.slice(0, -1).join(", ");
          lines.push(`${allButLast} and ${group[group.length - 1]} report no disclosures relevant to the manuscript.`);
        }
      } else {
        lines.push(entries[i].disclosureText);
        i++;
      }
    }

    setDisclosuresResponse(lines.join(" "));
  };


  useEffect(() => {
    if (piList.length > 0) {
      formatAuthors(piList);
      if (!uploadMode && searchedSites.length > 0) {
        formatFundingAck(piList, searchedSites);
        formatDisclosures(piList);
      }
    }
  }, [nameFormatOption, affiliationStyle]);


  const exportAsCSV = () => {
    if (piList.length === 0) {
      alert("No authors to export");
      return;
    }

    const searchedSites = siteInput.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s);

    const getAffStrings = (pi: PI): string[] => {
      if (pi.affiliations && pi.affiliations.length > 0) return pi.affiliations;
      const maxLen = Math.max(
        pi.department_list?.length || 0,
        pi.university_list?.length || 0,
        pi.city_list?.length || 0,
        pi.state_list?.length || 0,
        pi.country_list?.length || 0
      );
      const result: string[] = [];
      for (let i = 0; i < maxLen; i++) {
        const parts = [
          pi.department_list?.[i] || "",
          pi.university_list?.[i] || "",
          pi.city_list?.[i] || "",
          pi.state_list?.[i] || "",
          pi.country_list?.[i] || "",
        ].filter((p) => p);
        result.push(parts.join(", "));
      }
      return result;
    };

    const maxAffiliations = includeAffiliations
      ? Math.max(0, ...piList.map((pi) => getAffStrings(pi).length))
      : 0;


    const affiliationHeaders: string[] = [];
    if (includeAffiliations) {
      for (let i = 1; i <= maxAffiliations; i++) {
        const hasSeparateFields = piList.some(
          (pi) => !pi.affiliations && (pi.department_list?.length || pi.university_list?.length)
        );
        if (!affiliationJoined && hasSeparateFields) {
          affiliationHeaders.push(
            `AFFILIATION_${i}_DEPARTMENT`,
            `AFFILIATION_${i}_INSTITUTION`,
            `AFFILIATION_${i}_CITY`,
            `AFFILIATION_${i}_STATE_REGION`,
            `AFFILIATION_${i}_COUNTRY`
          );
        } else {
          affiliationHeaders.push(`AFFILIATION_${i}`);
        }
      }
    }

    // Helpers to extract structured funding and disclosure data per PI
    const getFundingEntries = (pi: PI): Array<{ grant_source: string; ref_id: string }> => {
      if (!pi.cohort_funding) return [];
      const entries: Array<{ grant_source: string; ref_id: string }> = [];
      pi.cohort_funding.forEach((entry) => {
        if (!uploadMode) {
          const cohortLower = entry.cohort.toLowerCase();
          if (!searchedSites.some((s) => cohortLower.includes(s))) return;
        }
        (entry.acknowledgements || []).forEach((ack) => {
          if (ack.grant_source.trim() || ack.ref_id.trim()) entries.push(ack);
        });
      });
      return entries;
    };

    const getDisclosureEntries = (pi: PI): Array<{ category: string; entity: string }> => {
      if (!pi.disclosures) return [];
      return (pi.disclosures as string[]).flatMap((d) => {
        try {
          const obj = JSON.parse(d);
          if (!obj.category) return [];
          if (obj.category === 'patents') {
            const parts = [obj.patent_product, obj.patent_ref ? `Ref: ${obj.patent_ref}` : '', obj.patent_institution].filter(Boolean).join(', ');
            return [{ category: obj.category, entity: parts }];
          }
          return [{ category: obj.category, entity: obj.details || '' }];
        } catch { return []; }
      });
    };

    const maxFunding = Math.max(0, ...piList.map((pi) => getFundingEntries(pi).length));
    const maxDisclosures = Math.max(0, ...piList.map((pi) => getDisclosureEntries(pi).length));

    const fundingHeaders: string[] = [];
    for (let i = 1; i <= maxFunding; i++) fundingHeaders.push(`GRANT_SOURCE_${i}`, `REF_ID_${i}`);

    const disclosureHeaders: string[] = [];
    for (let i = 1; i <= maxDisclosures; i++) disclosureHeaders.push(`DISCLOSURE_CATEGORY_${i}`, `DISCLOSURE_ENTITY_${i}`);

    const baseHeaders = ["Site", "First Name", "MI", "Last Name", "Email"];
    if (includeOrcid) baseHeaders.push("ORCID");
    const allHeaders = [...baseHeaders, ...affiliationHeaders, ...fundingHeaders, ...disclosureHeaders];
    const csvHeaders = allHeaders.map((h) => `"${h}"`).join(",") + "\n";

    const csvRows: string[] = [];

    piList.forEach((pi) => {
      const sites = pi.cohort_enigma_list || ["Unknown"];
      const sitesToInclude = uploadMode
        ? [sites[0] || "Unknown"]
        : sites.filter((site) =>
            searchedSites.some((searched) => site.toLowerCase().includes(searched))
          );

      sitesToInclude.forEach((site) => {
        const baseRow = [
          `"${site}"`,
          `"${pi.first_name}"`,
          `"${pi.MI || ""}"`,
          `"${pi.last_name}"`,
          `"${pi.primary_email}"`,
        ];
        if (includeOrcid) baseRow.push(`"${pi.orcid || ""}"`);

        if (includeAffiliations) {
          const affStrings = getAffStrings(pi);
          const hasSeparateFields = !pi.affiliations && (pi.department_list?.length || pi.university_list?.length);

          for (let i = 0; i < maxAffiliations; i++) {
            if (!affiliationJoined && hasSeparateFields) {
              baseRow.push(
                `"${pi.department_list?.[i] || ""}"`,
                `"${pi.university_list?.[i] || ""}"`,
                `"${pi.city_list?.[i] || ""}"`,
                `"${pi.state_list?.[i] || ""}"`,
                `"${pi.country_list?.[i] || ""}"`
              );
            } else {
              baseRow.push(`"${affStrings[i] || ""}"`);
            }
          }
        }

        const fundingEntries = getFundingEntries(pi);
        for (let i = 0; i < maxFunding; i++) {
          baseRow.push(`"${fundingEntries[i]?.grant_source || ""}"`, `"${fundingEntries[i]?.ref_id || ""}"`);
        }

        const disclosureEntries = getDisclosureEntries(pi);
        for (let i = 0; i < maxDisclosures; i++) {
          baseRow.push(`"${disclosureEntries[i]?.category || ""}"`, `"${disclosureEntries[i]?.entity || ""}"`);
        }

        csvRows.push(baseRow.join(","));
      });
    });

    csvRows.sort();

    let csv = csvHeaders + csvRows.join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `authors_list_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };


  const copyText = (text: string, setCopied: (v: boolean) => void) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const exportAsTXT = () => {
    if (!formattedResponse) {
      alert("No formatted authors to export");
      return;
    }

    const date = new Date().toISOString().split("T")[0];
    const sections: string[] = [`Authors:\n${formattedResponse}`];
    if (fundingAckResponse) sections.push(`Funding Acknowledgments:\n${fundingAckResponse}`);
    if (disclosuresResponse) sections.push(`Disclosures:\n${disclosuresResponse}`);

    const blob = new Blob([sections.join("\n\n")], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `authors_list_${date}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const singleColumns = [
    "Site", "First Name", "MI", "Last Name", "Email", "ORCID",
    "Affiliation_1", "Affiliation_2",
    "GRANT_SOURCE_1", "REF_ID_1", "GRANT_SOURCE_2", "REF_ID_2",
    "DISCLOSURE_CATEGORY_1", "DISCLOSURE_ENTITY_1",
  ];
  const multipleColumns = [
    "Site", "First Name", "MI", "Last Name", "Email", "ORCID",
    "AFFILIATION_1_DEPARTMENT", "AFFILIATION_1_INSTITUTION",
    "AFFILIATION_1_CITY", "AFFILIATION_1_STATE_REGION", "AFFILIATION_1_COUNTRY",
    "GRANT_SOURCE_1", "REF_ID_1", "GRANT_SOURCE_2", "REF_ID_2",
    "DISCLOSURE_CATEGORY_1", "DISCLOSURE_ENTITY_1",
  ];
  const singleExampleRow = [
    "R045", "Sook-Lei", "A", "Liew", "sliew@usc.edu", "0000-0001-2345-6789",
    "Chan Division, University of Southern California, Los Angeles, CA, USA",
    "ABC Institute, Keck School of Medicine, University of Southern California, Los Angeles, CA, USA",
    "NIH", "R01MH123456", "NSF", "BCS-7654321",
    "competing_interest", "Acme Corp",
  ];
  const multipleExampleRow = [
    "R045", "Sook-Lei", "A", "Liew", "sliew@usc.edu", "0000-0001-2345-6789",
    "Chan Division", "University of Southern California", "Los Angeles", "CA", "USA",
    "NIH", "R01MH123456", "NSF", "BCS-7654321",
    "competing_interest", "Acme Corp",
  ];

  const downloadTemplate = () => {
    const cols = csvPreviewMode === "single" ? singleColumns : multipleColumns;
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = cols.map(escape).join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `authors_template_${csvPreviewMode}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const copyForWordDocs = () => {
    if (!htmlResponse) return;
    const writeToClipboard = () => {
      if (navigator.clipboard && (navigator.clipboard as any).write) {
        const blob = new Blob([htmlResponse], { type: "text/html" });
        const item = new ClipboardItem({ "text/html": blob });
        (navigator.clipboard as any).write([item]).then(() => {
          setWordCopied(true);
          setTimeout(() => setWordCopied(false), 2000);
        });
      } else {
        const div = document.createElement("div");
        div.innerHTML = htmlResponse;
        div.style.position = "fixed";
        div.style.opacity = "0";
        document.body.appendChild(div);
        const range = document.createRange();
        range.selectNode(div);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        document.execCommand("copy");
        window.getSelection()?.removeAllRanges();
        document.body.removeChild(div);
        setWordCopied(true);
        setTimeout(() => setWordCopied(false), 2000);
      }
    };
    writeToClipboard();
  };

  const copyColumnNames = () => {
    const cols = csvPreviewMode === "single" ? singleColumns : multipleColumns;
    // Tab-separated so each column lands in its own Excel cell
    const text = cols.join("\t");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setColumnsCopied(true);
        setTimeout(() => setColumnsCopied(false), 2000);
      });
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setColumnsCopied(true);
      setTimeout(() => setColumnsCopied(false), 2000);
    }
  };

  return (
    <div className="p-3">
      {error && <Alert variant="danger">{error}</Alert>}

      <Form.Group className="mb-3">
        <Form.Label>Enter Site Name(s)</Form.Label>
        <Form.Control
          type="text"
          placeholder="e.g., R045, R123"
          value={siteInput}
          onChange={(e) => setSiteInput(e.target.value)}
          onKeyPress={handleSiteSearch}
        />
        <Form.Text className="text-muted">
          Search for PIs associated with specific site(s). Separate multiple sites with commas.
        </Form.Text>
      </Form.Group>
      
      <Button variant="primary" onClick={searchBySite} disabled={loading} className="mb-4">
        {loading ? "Loading..." : "Search"}
      </Button>

      <div className="d-flex align-items-center my-3">
        <hr className="flex-grow-1" />
        <span className="mx-2 text-muted small">OR</span>
        <hr className="flex-grow-1" />
      </div>

      <Form.Group className="mb-4">
        <Form.Label>Upload CSV</Form.Label>
        <Form.Control
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
        />
        <div className="mt-3">
          <h6 className="mb-1" style={{ fontWeight: 400 }}>CSV Format Template</h6>
          <p className="text-muted mb-2" style={{ fontSize: "13px" }}>
            Your CSV must include these column headers. The row below shows example values - replace them with your actual data.
            Use the toggle to switch between single-column and multi-column affiliation formats.
          </p>
          <div className="d-flex gap-2 mb-2">
            <button
              className={`btn btn-sm ${csvPreviewMode === "single" ? "btn-dark" : "btn-outline-dark"}`}
              type="button"
              onClick={() => setCsvPreviewMode("single")}
            >
              Affiliation as single column
            </button>
            <button
              className={`btn btn-sm ${csvPreviewMode === "multiple" ? "btn-dark" : "btn-outline-dark"}`}
              type="button"
              onClick={() => setCsvPreviewMode("multiple")}
            >
              Affiliation as multiple columns
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: "12px", whiteSpace: "nowrap" }}>
              <thead>
                <tr>
                  {(csvPreviewMode === "single" ? singleColumns : multipleColumns).map((col) => (
                    <th key={col} style={{ border: "1px solid #ccc", padding: "4px 8px", color: "black", fontWeight: 600, userSelect: "text" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {(csvPreviewMode === "single" ? singleExampleRow : multipleExampleRow).map((val, i) => (
                    <td key={i} style={{ border: "1px solid #ccc", padding: "4px 8px", color: "#999", userSelect: "text" }}>
                      {val}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="d-flex gap-2 mt-2">
            <Button size="sm" onClick={downloadTemplate} style={{ backgroundColor: '#e9ecef', color: '#212529', border: '1px solid #adb5bd' }}>
              Download Template CSV
            </Button>
            <Button size="sm" onClick={copyColumnNames} style={{ backgroundColor: '#e9ecef', color: '#212529', border: '1px solid #adb5bd' }}>
              {columnsCopied ? "Copied!" : "Copy Column Names"}
            </Button>
          </div>
          <div className="text-muted" style={{ fontSize: "12px", marginTop: "4px" }}>
            {csvPreviewMode === "single"
              ? ""
              : "Add AFFILIATION_2_DEPARTMENT, AFFILIATION_2_INSTITUTION, … for additional affiliations."}
          </div>
        </div>
        {uploadError && <Alert variant="danger" className="mt-2 mb-0">{uploadError}</Alert>}
      </Form.Group>

      {piList.length > 0 && (
        <>
          <div className="mt-4 mb-3">
            <h6>
              {uploadMode
                ? `Loaded ${piList.length} author(s) from CSV`
                : `Found ${piList.length} PI(s)`}
            </h6>
          </div>

          <Form className="mb-3">
            <Form.Label>Select Name Format</Form.Label>
            <Form.Check
              type="radio"
              id="initials-option"
              name="nameFormat"
              label="Initials (Ex: S.-L.L.)"
              onChange={() => setNameFormatOption(1)}
              checked={nameFormatOption === 1}
            />
            <Form.Check
              type="radio"
              id="full-name-option"
              name="nameFormat"
              label="Full Name (Ex: Sook-Lei Liew)"
              onChange={() => setNameFormatOption(2)}
              checked={nameFormatOption === 2}
            />
            <Form.Check
              type="radio"
              id="initials-lastname-option"
              name="nameFormat"
              label="Initials + Last Name (Ex: S.-L. Liew)"
              onChange={() => setNameFormatOption(3)}
              checked={nameFormatOption === 3}
            />
          </Form>

          <Form className="mb-3">
            <Form.Label>Affiliation Style</Form.Label>
            <Form.Check
              type="radio"
              id="aff-bracket"
              name="affiliationStyle"
              label="Square brackets (Ex: Name [1][2])"
              onChange={() => setAffiliationStyle("bracket")}
              checked={affiliationStyle === "bracket"}
            />
            <Form.Check
              type="radio"
              id="aff-superscript"
              name="affiliationStyle"
              label={`Superscript (Ex: Name${toSup(1)}${toSup(2)})`}
              onChange={() => setAffiliationStyle("superscript")}
              checked={affiliationStyle === "superscript"}
            />
          </Form>

          <Form.Group className="mb-2">
            <Form.Label>Formatted Authors</Form.Label>
            <StyledTextarea
              minRows={4}
              value={formattedResponse}
              readOnly
            />
          </Form.Group>
          <div className="mb-3">
            <Button
              onClick={copyForWordDocs}
              style={{ backgroundColor: '#e9ecef', color: '#212529', border: '1px solid #adb5bd' }}
            >
              {wordCopied ? "Copied!" : "Copy for Word / Google Docs"}
            </Button>
          </div>

          {!uploadMode && fundingAckResponse && (
            <Form.Group className="mb-2">
              <Form.Label>Funding Acknowledgments</Form.Label>
              <StyledTextarea
                minRows={4}
                value={fundingAckResponse}
                readOnly
              />
            </Form.Group>
          )}
          {!uploadMode && fundingAckResponse && (
            <div className="mb-3">
              <Button
                onClick={() => copyText(fundingAckResponse, setFundingCopied)}
                style={{ backgroundColor: '#e9ecef', color: '#212529', border: '1px solid #adb5bd' }}
              >
                {fundingCopied ? "Copied!" : "Copy Text"}
              </Button>
            </div>
          )}

          {!uploadMode && disclosuresResponse && (
            <Form.Group className="mb-2">
              <Form.Label>Disclosures</Form.Label>
              <StyledTextarea
                minRows={4}
                value={disclosuresResponse}
                readOnly
              />
            </Form.Group>
          )}
          {!uploadMode && disclosuresResponse && (
            <div className="mb-3">
              <Button
                onClick={() => copyText(disclosuresResponse, setDisclosuresCopied)}
                style={{ backgroundColor: '#e9ecef', color: '#212529', border: '1px solid #adb5bd' }}
              >
                {disclosuresCopied ? "Copied!" : "Copy Text"}
              </Button>
            </div>
          )}
          <Form.Check
            type="checkbox"
            id="include-orcid"
            label="Include ORCID in CSV export"
            checked={includeOrcid}
            onChange={(e) => setIncludeOrcid(e.target.checked)}
            className="mb-2"
          />
          <Form.Check
            type="checkbox"
            id="include-affiliations"
            label="Include affiliations in CSV export"
            checked={includeAffiliations}
            onChange={(e) => setIncludeAffiliations(e.target.checked)}
            className="mb-2"
          />
          {includeAffiliations && (
            <div className="ms-4 mb-2">
              <Form.Check
                type="radio"
                id="affiliation-joined"
                name="affiliationFormat"
                label="Single joined field per affiliation (e.g. AFFILIATION_1)"
                checked={affiliationJoined}
                onChange={() => setAffiliationJoined(true)}
                className="mb-1"
              />
              <Form.Check
                type="radio"
                id="affiliation-separate"
                name="affiliationFormat"
                label="Separate fields per affiliation (e.g. AFFILIATION_1_DEPARTMENT, AFFILIATION_1_INSTITUTION, …)"
                checked={!affiliationJoined}
                onChange={() => setAffiliationJoined(false)}
              />
            </div>
          )}
          <div className="d-flex gap-2">
            <Button onClick={exportAsCSV} style={{ backgroundColor: '#e9ecef', color: '#212529', border: '1px solid #adb5bd' }}>
              Export as CSV
            </Button>
            <Button onClick={exportAsTXT} style={{ backgroundColor: '#e9ecef', color: '#212529', border: '1px solid #adb5bd' }}>
              Export as TXT
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default AuthorsList;
