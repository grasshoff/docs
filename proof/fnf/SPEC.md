# Famulus Normal Form — technical specification (famulus-fnf/1)

Companion of the article `famulus-normal-form.qmd`. This file is the contract between the compilers, the
normaliser, the DuckDB index and the matcher. Code: `src/famulus_proof/fnf/`.

## Layers

| layer | content | producer | stored in |
|---|---|---|---|
| L0 | text | corpus | `fnf_sentence.text_sha` |
| L1 | frame (propositions, roles, CNF over propositions) | UD compiler, LLM compiler, ensemble | `fnf_sentence.frame` |
| L2 | normalised clause set: concept keys, canonical orientation, distributed plurals, derived literals | `normalise.py` (deterministic) | `fnf_atom`, `fnf_atom_role`, `fnf_lit` |
| L3 | the same, indexed for joins | `index.py` | DuckDB |

L1 is rule-free and dictionary-free. Everything that can be improved without a model call (a dictionary edge, a rule)
lives in L2 and is re-derived from L1 without recompiling the corpus.

## Frame (L1)

JSON Schema: `config/fnf/frame.schema.json`. Propositions carry `pred`, `roles` (role → list of values), `mod`,
`holder`, `plural`. `cnf` is a list of clauses of literals `[prop, sign]`. An embedded proposition (`mod: embedded`)
is not asserted; a complement-taking predicate refers to it by `roles.comp = ["#j"]`; an event reference in another role
(`after(theme #0, comp #1)`) uses the same form.

Value forms: `ent:Name` (titles, particles and accents removed → `e:name`), lemma (→ concept by the dictionary, else
`lex:<lang>:<lemma>`), `num:12`, `num:3..5`, ISO dates (`1938`, `1938-03`, `1938-03-14` → rows `time.year`, `time.month`,
`time.day` with intervals), weekdays as lemmas.

## Normalisation (L2)

1. **Concepts.** `Dictionary.concept_of(lang, lemma)`: lemma table → `c:<lemma>` if a concept of that key exists →
   `lex:<lang>:<lemma>`.
2. **Orientation.** Converse predicates are rewritten to the canonical one (source of the `converse` edge) with agent
   and theme swapped; complementary antonyms to the canonical polarity (`unmarried(x)` = `¬married(x)`). Propositions
   that refer to events keep their predicate.
3. **Plurals.** Distributive: one atom per value of the first distributable role (cap 8), one unit clause each (a
   disjunction distributes into several clauses). Collective: one joint value `set:a+b`.
4. **One participant.** A proposition with exactly one of agent/theme/patient/experiencer stores it as `arg`; the
   choice among the three is the compiler's, not the meaning's.
5. **Atoms.** `key = pred|mod|holder|role=val;…`; `atom_id` = blake2b-64 of the key (63 bit).
6. **Derived literals**, in two passes. Pass 1 (strength N/P): definitions (`unmarried ∧ man ⇒ bachelor`),
   implicatives (`manage V ⊨ V`, `fail V ⊨ ¬V`), presuppositions (projected through negation and `possible`, only from a
   unit clause). Pass 2 (strength I/D/A): implicatures, defaults, abductive candidates; each is dropped when a literal
   of pass 1 contradicts it, when a named defeater predicate occurs in the sentence, or (implicature) when the sentence
   makes the stronger alternative possible.

## Literal entailment

`m ⊨ l` for literals, by sign:

| m | l | holds iff |
|---|---|---|
| + a | + b | atom a subsumes b: predicate and modality up the dictionary, same holder, every row of b entailed by a row of a (concept: `concept_up`; interval: containment) |
| − a | − b | b subsumes a |
| + a | − b | a excludes b: antonym or disjoint predicates over entailed rows, or a clash on a functional role (`time.*`, `place`) inside one event |
| − a | + b | complementary antonyms with identical participants |

## The four cells and the labels

S the stored sentence, P the probe. `TF` impossible ⇔ S entails P (every P clause covered by an S clause, with
disjunctive syllogism). `FT` impossible ⇔ P entails S. `TT` impossible ⇔ unit propagation over both clause sets reaches
an empty clause. `FF` impossible ⇔ every pair of negated base clauses is inconsistent. The impossible set maps to the
eight-label catalogue of `famulus-logic` (relations 1.1.0); the weak label is read with the premises of strength I, D, A
added and only when the strict label is `independent` or `subcontrary`.

## Strength

N necessary (5) > P presupposed (4) > H hedged (3) > I implicated (2) > D defeasible (1); A abductive is a label of its
own. The strength of a verdict is the minimum over the literals and dictionary edges it used. Dictionary edges carry
`strength` (N/D) and an evidence `grade` (DOCUMENTED > INFERRED > HYPOTHESIS); the certified tier uses N and DOCUMENTED
only. Defeater anti-join: a weak verdict is dropped when the sentence contains a positive atom whose predicate is a
declared defeater of the rule; necessary and presupposed verdicts never depend on a defeater (monotone).

## Certificate

```json
{"engine": "famulus-fnf/1", "S": "...", "P": "...", "impossible": ["TF"],
 "trails": {"TF": [{"S": "c:observe(arg=e:tycho,theme=e:mars)", "P": "c:observe(...)", "via": "e:mars < c:planet",
                    "edges": [["e:mars", "isa*", "c:planet"]]}]},
 "grade": "DOCUMENTED", "edges": [...], "weak_trail": [...], "weak_rules": ["D.scheduled_occurs"],
 "assumptions": ["..."], "defeaters": ["c:postpone"], "rivals": [], "notes": []}
```

## Corpus-facing rules (added after the haystack runs)

* **Informativeness gate.** `match_sql.match(con, min_rows=1)` drops sentences none of whose atoms has a role row. A fragment
  such as "COPY" or "IN REPLY" is entailed by any probe that uses the predicate and subcontrary to its negation; on the
  180,559-sentence hay the gate removes 2,574 of 2,576 hits. Corpus callers (`infer`, `fnf_hay.py`) use it; the unit
  tests of the core keep `min_rows=0`.
* **WordNet keys.** The WordNet import writes synset keys (`wn:document.n.01`), never lemma keys for intermediate nodes, so that
  the senses of a polysemous lemma cannot merge; the lemma's own `c:<lemma>` concept points at its first-sense synset. All of these
  edges are graded INFERRED and so never enter the certified tier.
* **Circumstance inheritance.** Default and abductive rules copy the `time.*`, `place` and `amount*` rows of the trigger onto the derived
  atom (`derive.inherit`, on by default for these kinds): an explanation of an event holds in the event's circumstances.
* **Shards.** `scripts/fnf_shard.py` splits the corpus by document hash, writes Parquet per shard (atomic rename, resumable) and merges
  with `distinct on (atom_id)`.

## DuckDB

`schema.sql` (tables `fnf_sentence`, `fnf_atom`, `fnf_atom_role`, `fnf_lit`) and the dictionary tables `concept`,
`lemma_concept`, `concept_edge`, `concept_up`, `concept_antonym`, `concept_excl`, `mod_up`. `match_sql.match` joins one
loaded probe against all sentences; the result is exact when every base clause of S and P is a unit, otherwise
`exact = false` and the Python matcher verifies.
