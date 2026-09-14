This archive contains data and analysis for the paper

Enrica Troiano, Sebastian Pado, and Roman Klinger:
"Crowdsourcing and Validating Event-focused Emotion Corpora for German and English", ACL2019.

@inproceedings{Troiano2019,
  author = {Enrica Troiano and Sebastian Pad\'o and Roman Klinger},
  title = {{Crowdsourcing and Validating Event-focused Emotion Corpora for German and English}},
  booktitle = {Proceedings of the Annual Conference of the Association for Computational Linguistics},
  year = {2019},
  address = {Florence, Italy},
  organization = {Association for Computational Linguistics},
}

If you use this data, please cite our paper.

If you have questions, please contact us at
enrica.troiano@ims.uni-stuttgart.de


This archive contains the following files:

* enISEAR.tsv
  Collection of 1001 English event-focused descriptions (Phase 1 experiment).
  The file includes aggregated information from Phase 2.

* deISEAR.tsv
  Collection of 1001 German event-focused descriptions (Phase 1 experiment).
  The file includes aggregated information from Phase 2.


* enISEAR_validation.tsv
  Complete validations of sentences of enISEAR (Phase2 experiment).

* deISEAR_validation.tsv
  Complete validations of the sentences of deISEAR (Phase2 experiment).


* de2enISEAR.tsv
  English translation of the sentences in deISEAR (used for
  classification).


* analysis_enISEAR.tsv
  Sample of 385 items from enISEAR, post-annotated for analysis
  motivated by appraisal theory.

* analysis_de2enISEAR.tsv
  Sample of 385 items from de2enISEAR, post-annotated for analysis
  motivated by appraisal theory.


* license.txt, the licence for data distribution upon acceptance of the paper.
  Note that redistribution during review is not allowed.


The corpora are released under the
Open Data Commons Attribution License (ODC-By) v1.0
(https://www.opendatacommons.org/licenses/by/1.0/).

The followings are the abbreviations used for the metadata labels in the German files:

Metadata	   Abbreviation
# Temporal Distance
vor_tagen          T
vor_wochen         W
vor_monaten        M
vor_jahren         J
# Intensity
nicht_sehr         N
mig_intensiv       Mi
intensiv           I
sehr_intensiv      S
# Duration
ein_paar_minuten   Epm
eine_stunde        Es
mehrere_stunden    Ms
ein_tag_oder_lnger Tol
# Gender
ein_mann           Ml
eine_frau          Fl
andere             A
# Country
Germany            DEU
Austria            AUT


The followings are the abbreviations used for the metadata labels in the English files:

Metadata           Abbreviation
# Temporal Distance
days_ago           D
weeks_ago          W
months_ago         M
years_ago          Y
# intensity
not_very           N
moderately_intense Mi
intense            I
very_intense       Vi
# Duration
a_few_minutes      Fm
an_hour            H
several_hours      Sh
a_day_or_more      Dom
# Gender
male               Ml
female             Fl
other              O
# Country
United Kingdom    GBR
Ireland    IRL

The columns in the post-annotation are following the order as
mentioned in Table 3:
* General event
* Future event
* Past event
* Prospective
* Social
* Self conseq.
* Conseq other
* Situational control
* Responsible
