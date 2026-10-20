# Crime Records of India — AI Schema Summary Document

Total Tables: **17**

---

## 1. `"auto_theft"` (Property Crime - Auto Theft)
- **Total Records:** 1857
- **Summary:** The auto_theft table records the number of motor vehicle thefts across Indian states and union territories by year, broken down by vehicle type groups. It includes counts of stolen vehicles, recovered vehicles, and incidents that were coordinated or traced. This enables analysis of theft trends over time, regional differences, and effectiveness of recovery efforts.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the state or union territory — *Samples: ["Andaman & Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar"]*
  - `"Year"` (integer): Year of the reported theft data — *Samples: [2001,2002,2003,2004,2005]*
  - `"Group_Name"` (text): Vehicle type group identifier and description — *Samples: ["AT1-Motor Cycles/ Scooters","AT2-Motor Car/Taxi/Jeep","AT3-Buses","AT4-Goods carrying vehicles (Trucks/Tempo etc)","AT5-Other Motor vehicles"]*
  - `"Sub_Group_Name"` (text): Numeric label and description of the vehicle type — *Samples: ["1. Motor Cycles/ Scooters","2. Motor Car/Taxi/Jeep","3. Buses","4. Goods carrying vehicles (Trucks/Tempo etc)","5. Other Motor vehicles"]*
  - `"Auto_Theft_Coordinated/Traced"` (text): Number of theft incidents that were coordinated or traced (stored as text) — *Samples: ["0","1","10","100","1004"]*
  - `"Auto_Theft_Recovered"` (integer): Count of stolen vehicles that were recovered
  - `"Auto_Theft_Stolen"` (integer): Count of vehicles reported stolen

---

## 2. `"cases_under_crime_against_women"` (Crimes Against Women)
- **Total Records:** 4165
- **Summary:** This table records annual case statistics for various offences against women, broken down by Indian state/union territory (Area_name) and crime sub‑groups. Each row captures counts of reported, investigated, trial‑related, and disposition outcomes for a specific year, enabling analysis of trends, regional disparities, and case‑flow performance across different types of women‑related crimes.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the Indian state or union territory — *Samples: ["Andaman & Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar"]*
  - `"Year"` (integer): Fiscal year of the record — *Samples: [2001,2002,2003,2004,2005]*
  - `"Group_Name"` (text): Broad category of the offence against women — *Samples: ["Cruelty by Husband and Relatives","Dowry Deaths","Immoral Traffic (Prevention) Act","Importation of Girls","Indecent Representation of Women (Prohibition) Act"]*
  - `"Sub_Group_Name"` (text): Specific sub‑category of the offence — *Samples: ["01. Rape","02. Kidnapping & Abduction of Women & Girls","03. Dowry Deaths","04. Molestation","05. Sexual Harassment"]*
  - `"Cases_Acquitted_or_Discharged"` (integer): Number of cases where the accused was acquitted or discharged
  - `"Cases_charge_sheets_were_not_laid_but_Final_Report_submitted"` (integer): Cases with final report submitted but no charge sheet filed
  - `"Cases_Chargesheeted"` (integer): Number of cases for which a charge sheet was filed
  - `"Cases_Compounded_or_Withdrawn"` (integer): Cases that were compounded or withdrawn before trial
  - `"Cases_Convicted"` (integer): Number of cases resulting in conviction
  - `"Cases_Declared_False_on_Account_of_Mistake_of_Fact_or_of_Law"` (integer): Cases dismissed as false due to factual or legal error
  - `"Cases_Investigated_Chargesheets+FR_Submitted"` (integer): Cases investigated and either charge‑sheeted or final report submitted
  - `"Cases_not_Investigated_or_in_which_investigation_was_refused"` (integer): Cases that were not investigated or where investigation was refused
  - `"Cases_Pending_Investigation_at_Year_End"` (integer): Investigations still pending at the end of the year — *Samples: [0,1,2,3,4]*
  - `"Cases_Pending_Investigation_from_previous_year"` (integer): Investigations carried over from previous year — *Samples: [0,1,2,3,4]*
  - `"Cases_Pending_Trial_at_Year_End"` (integer): Trials pending at year‑end — *Samples: [0,1,2,3,4]*
  - `"Cases_Pending_Trial_from_the_previous_year"` (integer): Trials pending from previous year — *Samples: [0,1,2,3,4]*
  - `"Cases_Reported"` (integer): Total cases reported to police
  - `"Cases_Sent_for_Trial"` (integer): Cases forwarded to court for trial
  - `"Cases_Trials_Completed"` (integer): Trials that were completed within the year
  - `"Cases_Withdrawn_by_the_Govt"` (integer): Cases withdrawn by the government during trial
  - `"Cases_withdrawn_by_the_Govt_during_investigation"` (integer): Cases withdrawn by the government during investigation
  - `"Total_Cases_for_Trial"` (integer): Total number of cases slated for trial

---

## 3. `"ch_not_murder_victim_age_sex"` (Violent Crime)
- **Total Records:** 936
- **Summary:** The table records non‑murder victim counts broken down by age groups, sex, and total, for each Indian state/union territory and year. It enables analysis of how victim demographics vary across regions and over time, supporting queries such as age‑wise victim trends, gender disparities, and regional comparisons.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the state or union territory — *Samples: ["Andaman & Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar"]*
  - `"Year"` (integer): Calendar year of the record — *Samples: [2001,2002,2003,2004,2005]*
  - `"Sub_Group_Name"` (text): Victim subgroup (e.g., Male Victims, Female Victims, Total) — *Samples: ["1. Male Victims","2. Female Victims","3. Total"]*
  - `"Victims_Above_50_Yrs"` (integer): Count of victims older than 50 years
  - `"Victims_Total"` (integer): Total number of victims in the subgroup
  - `"Victims_Upto_10_15_Yrs"` (text): Count of victims aged up to 10‑15 years (stored as text) — *Samples: ["0","1","10","11","12"]*
  - `"Victims_Upto_10_Yrs"` (integer): Count of victims aged up to 10 years
  - `"Victims_Upto_15_18_Yrs"` (text): Count of victims aged up to 15‑18 years (stored as text) — *Samples: ["0","1","10","100","11"]*
  - `"Victims_Upto_18_30_Yrs"` (integer): Count of victims aged 18‑30 years
  - `"Victims_Upto_30_50_Yrs"` (integer): Count of victims aged 30‑50 years

---

## 4. `"complaints_against_police"` (Police Misconduct)
- **Total Records:** 350
- **Summary:** This table records annual statistics on complaints and disciplinary actions against police personnel across Indian states and union territories. Each row is identified by Area_name, Year, and Sub_group, and includes counts of cases registered, reported, investigated, and outcomes such as convictions, acquittals, and punishments. It enables analysis of trends in police accountability, the effectiveness of departmental inquiries, and regional variations in police misconduct handling.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the state or union territory — *Samples: ["Andaman & Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar"]*
  - `"Year"` (integer): Fiscal year of the record — *Samples: [2001,2002,2003,2004,2005]*
  - `"Sub_group"` (text): Category of the data, e.g., Complaints Against Police Personnel — *Samples: ["Complaints Against Police Personnel"]*
  - `"CPA_-_Cases_Registered"` (integer): Total complaints/cases registered against police
  - `"CPA_-_Cases_Reported_for_Dept._Action"` (integer): Complaints forwarded for departmental action
  - `"CPA_-_Complaints/Cases_Declared_False/Unsubstantiated"` (integer): Complaints found false or unsubstantiated
  - `"CPA_-_Complaints_Received/Alleged"` (integer): Number of complaints received or alleged incidents
  - `"CPA_-_No_of_Departmental_Enquiries"` (integer): Count of departmental enquiries conducted
  - `"CPA_-_No_of_Magisterial_Enquiries"` (integer): Count of magisterial enquiries conducted
  - `"CPA-_Cases_Sent_for_Trials/Charge-sheeted"` (integer): Cases sent for trial or charge‑sheeted
  - `"CPA-_No_of_Judicial_Enquiries"` (integer): Number of judicial enquiries initiated
  - `"CPB_-_Police_Personnel_Acquitted"` (integer): Police personnel acquitted in cases
  - `"CPB_-_Police_Personnel_Convicted"` (integer): Police personnel convicted in cases
  - `"CPB_-_Police_Personnel_sent_up_for_Trial"` (integer): Police personnel sent up for trial
  - `"CPB_-_Police_Personnel_Trial_Completed"` (integer): Trials of police personnel that have been completed
  - `"CPB-_Police_Personnel_Cases_Withdrawn_or_Otherwise_disposed_of"` (integer): Cases against police personnel withdrawn or otherwise disposed
  - `"CPC_-_Police_personnel_Cases_Trial_Completed"` (integer): Police personnel cases where trial completed (CPC category)
  - `"CPC_-_Police_Personnel_Cases_Withdrawn_or_Otherwise_disposed_of"` (integer): Police personnel cases withdrawn or otherwise disposed (CPC)
  - `"CPC_-_Police_Personnel_Disciplinary_Action_Initiated"` (integer): Disciplinary actions initiated against police personnel
  - `"CPC_-_Police_Personnel_Dismissal/Removal_from_Service"` (integer): Police personnel dismissed or removed from service
  - `"CPC_-_Police_Personnel_Major_Punishment_awarded"` (integer): Major punishments awarded to police personnel
  - `"CPC_-_Police_Personnel_Minor_Punishment_awarded"` (integer): Minor punishments awarded to police personnel

---

## 5. `"custodial_death_during_hospitalization_or_treatment"` (Custodial Deaths)
- **Total Records:** 213
- **Summary:** The table records the number of custodial deaths that occurred during hospitalisation or treatment, broken down by Indian state (Area_name) and calendar year. It includes grouping information to differentiate the broader category from specific sub‑categories of such deaths. This enables analysis of trends over time, regional comparisons, and the impact of different treatment contexts on custodial mortality.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the Indian state or union territory — *Samples: ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chandigarh"]*
  - `"Year"` (integer): Calendar year of the reported deaths — *Samples: [2001,2002,2003,2004,2005]*
  - `"Group_Name"` (text): Broad classification of the death context (e.g., during hospitalisation/treatment) — *Samples: ["During Hospitalisation/Treatment/Other Reasons"]*
  - `"Sub_Group_Name"` (text): Specific sub‑category describing the type of death within the group — *Samples: ["4. Deaths during Hospitalisation/Treatment","4. Deaths during Hospitalisation/TTTTTT"]*
  - `"CD_Hospitalisation_Treatment"` (integer): Count of deaths occurring during hospitalisation or treatment

---

## 6. `"custodial_death_others"` (Custodial Deaths)
- **Total Records:** 233
- **Summary:** The table records the number of deaths of individuals in custody in India, categorized by state (Area_name) and year, and further broken down by cause sub‑groups such as accidents, mob attacks, other criminals, suicide, illness/natural causes, and deaths while escaping. It enables analysis of trends over time and comparisons across regions for non‑natural custodial deaths.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the Indian state or union territory — *Samples: ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chandigarh"]*
  - `"Year"` (integer): Calendar year of the recorded deaths — *Samples: [2001,2002,2003,2004,2005]*
  - `"Group_Name"` (text): Broad classification of the death context (e.g., during hospitalization) — *Samples: ["During Hospitalisation/Treatment/Other Reasons"]*
  - `"Sub_Group_Name"` (text): Specific sub‑category of death reason — *Samples: ["5. Deaths due to Other Reasons"]*
  - `"CD_Accidents"` (integer): Count of custodial deaths classified as accidents
  - `"CD_By_Mob_AttackRiots"` (integer): Count of deaths caused by mob attacks or riots while in custody
  - `"CD_By_other_Criminals"` (integer): Count of deaths caused by other criminals while in custody
  - `"CD_By_Suicide"` (integer): Count of suicides occurring in custody
  - `"CD_IllnessNatural_Death"` (integer): Count of deaths due to illness or natural causes while in custody
  - `"CD_While_Escaping_from_Custody"` (integer): Count of deaths that occurred while the person was escaping custody

---

## 7. `"custodial_death_person_not_remanded"` (Custodial Deaths)
- **Total Records:** 228
- **Summary:** The table records annual statistics on deaths occurring in custody or lockup of individuals who were not remanded to police custody by a court, broken down by Indian state/area. Each row captures reported deaths, autopsies, related case registrations, judicial and magisterial enquiries, and outcomes for police officers involved, enabling analysis of trends, regional variations, and accountability measures over time.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the Indian state or union territory — *Samples: ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chandigarh"]*
  - `"Year"` (integer): Fiscal year of the reported data — *Samples: [2001,2002,2003,2004,2005]*
  - `"Group_Name"` (text): Broad classification of the data group — *Samples: ["Persons Not Remand to Police Custody by Court"]*
  - `"Sub_Group_Name"` (text): Specific sub‑category describing the type of custodial death — *Samples: ["2. Deaths in Custody/Lockup of Persons Not Remanded to Police Custody by Court"]*
  - `"CD_Deaths_Reported"` (integer): Number of deaths reported in the specified category
  - `"CD_No_of_Autopsy_conducted"` (integer): Number of autopsies performed on reported deaths
  - `"CD_No_of_Cases_registered_in_connection_with_deaths"` (integer): Number of legal cases registered related to the deaths
  - `"CD_No_of_Judicial_enquiry_orderedconducted"` (text): Number of judicial enquiries ordered or conducted (stored as text) — *Samples: ["0","1","2","3","4"]*
  - `"CD_No_of_Magisterial_enquiry_orderedconducted"` (integer): Number of magisterial enquiries ordered or conducted
  - `"CD_No_of_Policemen_Charge_sheeted"` (integer): Number of policemen charged in connection with the deaths
  - `"CD_No_of_Policemen_Convicted"` (integer): Number of policemen convicted in connection with the deaths

---

## 8. `"custodial_death_person_remanded"` (Custodial Deaths)
- **Total Records:** 211
- **Summary:** The table records annual custodial death statistics for persons remanded to police custody by court, broken down by Indian state/union territory. It captures counts of deaths, autopsies, case registrations, judicial and magisterial enquiries, and police personnel charged and convicted, enabling analysis of trends, regional variations, and the effectiveness of investigative and prosecutorial actions.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the state or union territory — *Samples: ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chandigarh"]*
  - `"Year"` (integer): Calendar year of the record — *Samples: [2001,2002,2003,2004,2005]*
  - `"Group_Name"` (text): Broad grouping of the data (e.g., persons remanded to police custody by court) — *Samples: ["Persons Remand to Police Custody by Court"]*
  - `"Sub_Group_Name"` (text): Specific sub‑category describing the metric (e.g., deaths in custody/lockup) — *Samples: ["1. Deaths in Custody/Lockup of Persons Remanded to Police Custody by Court"]*
  - `"CD_Deaths_Reported"` (integer): Number of deaths reported in custody for the area and year
  - `"CD_No_of_Autopsy_conducted"` (integer): Number of autopsies performed on the reported deaths
  - `"CD_No_of_Cases_registered_in_connection_with_deaths"` (integer): Number of cases registered related to those deaths
  - `"CD_No_of_Judicial_enquiry_orderedconducted"` (integer): Number of judicial enquiries ordered or conducted
  - `"CD_No_of_Magisterial_enquiry_orderedconducted"` (integer): Number of magisterial enquiries ordered or conducted
  - `"CD_No_of_Policemen_Charge_sheeted"` (integer): Number of policemen charged in connection with the deaths
  - `"CD_No_of_Policemen_Convicted"` (integer): Number of policemen convicted in connection with the deaths

---

## 9. `"human_rights_violation_by_police"` (Human Rights Violations)
- **Total Records:** 2267
- **Summary:** The table records police‑related human‑rights violation incidents reported in Indian states/union territories for each year. It captures the number of cases registered, the number of policemen charged, and the number convicted, broken down by victim group and sub‑group. Analysts can examine trends over time, compare states, and assess accountability outcomes for different violation types.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the Indian state or union territory — *Samples: ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chandigarh"]*
  - `"Year"` (integer): Calendar year of the reported data — *Samples: [2001,2002,2003,2004,2005]*
  - `"Group_Name"` (text): Broad category of the human‑rights violation (e.g., atrocities on SC/ST, disappearance of persons) — *Samples: ["HR_Atrocities on SC/ST","HR_Disappearance of Persons","HR_Extortion","HR_Failure in taking action","HR_Fake encounter killings"]*
  - `"Sub_Group_Name"` (text): Specific sub‑category of the violation within the group — *Samples: ["01. Disappearance of Persons","02. Illegal Detention/Arrests","03. Fake Encounter Killings","04. Violation Against Terrorists/Extremists","05. Extortion"]*
  - `"Cases_Registered_under_Human_Rights_Violations"` (integer): Total number of violation cases filed in that area and year
  - `"Policemen_Chargesheeted"` (integer): Number of police officers formally charged in those cases
  - `"Policemen_Convicted"` (integer): Number of police officers convicted for the violations

---

## 10. `"murder_victim_age_sex"` (Violent Crime)
- **Total Records:** 1018
- **Summary:** The table records murder victim counts broken down by age brackets, gender, and total, for each Indian state or union territory and year. It provides granularity at the Area (state/UT) and Year level, with additional grouping by victim sex (male, female) and overall totals. This enables analysis of temporal trends, regional differences, and age‑sex distribution of murder victims.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the Indian state or union territory — *Samples: ["Andaman & Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar"]*
  - `"Year"` (integer): Calendar year of the reported murders — *Samples: [2001,2002,2003,2004,2005]*
  - `"Group_Name"` (text): Category of victims (e.g., Male Victims, Female Victims, Total Victims) — *Samples: ["Murder - Female Victims","Murder - Male Victims","Murder - Total Victims"]*
  - `"Sub_Group_Name"` (text): Sub‑category label within the group — *Samples: ["1. Male Victims","2. Female Victims","3. Total"]*
  - `"Victims_Above_50_Yrs"` (text): Number of victims older than 50 years (stored as text) — *Samples: ["0","1","10","100","101"]*
  - `"Victims_Total"` (integer): Total number of murder victims for the record
  - `"Victims_Upto_10_15_Yrs"` (text): Number of victims aged up to 10‑15 years (text) — *Samples: ["0","1","10","11","12"]*
  - `"Victims_Upto_10_Yrs"` (text): Number of victims aged up to 10 years (text) — *Samples: ["0","1","10","107","11"]*
  - `"Victims_Upto_15_18_Yrs"` (text): Number of victims aged up to 15‑18 years (text) — *Samples: ["0","1","10","102","103"]*
  - `"Victims_Upto_18_30_Yrs"` (integer): Number of victims aged up to 18‑30 years (integer)
  - `"Victims_Upto_30_50_Yrs"` (integer): Number of victims aged up to 30‑50 years (integer)

---

## 11. `"period_of_trials_by_courts"` (Criminal Justice - Trial Duration)
- **Total Records:** 1786
- **Summary:** The table records the number of cases pending in various courts across Indian states/union territories, broken down by the length of time the cases have been in trial for each year. It provides granularity at the Area (state/UT) and Year level, further segmented by court type (Group_Name and Sub_Group_Name). This enables analysis of trial backlog trends, identification of courts with prolonged case durations, and assessment of the effectiveness of judicial reforms over time.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the Indian state or union territory — *Samples: ["Andaman & Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar"]*
  - `"Year"` (integer): Calendar year of the recorded data — *Samples: [2004,2005,2006,2007,2008]*
  - `"Group_Name"` (text): Broad category of court type (e.g., District Judge, Additional Session Judge) — *Samples: ["PT1. District/Session Judge","PT2. Additional Session Judge","PT3. Chief Judicial Magistrate","PT4. Judicial Magistrate (I)","PT5. Judicial Magistrate (II)"]*
  - `"Sub_Group_Name"` (text): Specific sub‑category within the court group — *Samples: ["1. District/Session Judge","2. Additional Session Judge","3. Chief Judicial Magistrate","4. Judicial Magistrate (I)","5. Judicial Magistrate (II)"]*
  - `"PT_1_3_Years"` (integer): Number of cases pending 1 to 3 years in trial — *Samples: [0,1,2,3,4]*
  - `"PT_3_5_Years"` (integer): Number of cases pending 3 to 5 years in trial — *Samples: [0,1,2,3,4]*
  - `"PT_5_10_Years"` (integer): Number of cases pending 5 to 10 years in trial — *Samples: [0,1,2,3,4]*
  - `"PT_6_12_Months"` (integer): Number of cases pending 6 to 12 months in trial
  - `"PT_Less_than_6_Months"` (integer): Number of cases pending less than 6 months in trial
  - `"PT_Over_10_Years"` (integer): Number of cases pending over 10 years in trial — *Samples: [0,1,2,3,4]*
  - `"PT_Total"` (integer): Total number of pending cases across all time brackets

---

## 12. `"police_housing"` (Police Resources)
- **Total Records:** 696
- **Summary:** The police_housing table records the number of police housing units allocated and leased to various police personnel groups across Indian states/union territories for each fiscal year. It captures the area (state), year, personnel group and sub‑group, the count of houses provided directly by the department, houses obtained on lease/rent under GPRA, and the sanctioned strength for housing. This enables analysis of housing provision trends, resource allocation equity across regions, and comparison of departmental versus leased accommodations.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the Indian state or union territory — *Samples: ["Andaman & Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar"]*
  - `"Year"` (integer): Fiscal year of the record — *Samples: [2001,2002,2003,2004,2005]*
  - `"Group_Name"` (text): Broad classification of police personnel (e.g., officers, upper sub‑ordinates) — *Samples: ["PH_Officers (DySP & Above)","PH_Upper Subordinates (A.S.I. to Inspectors)"]*
  - `"Sub_Group_Name"` (text): Specific sub‑category within the group — *Samples: ["1. For Officers (Dy.SP & Above)","2. Upper SubOrdinates (ASI to Inspectos)"]*
  - `"PH_Houses_Provided_by_Department"` (integer): Number of police houses directly provided by the department
  - `"PH_Houses_provided_on_LeaseRentGPRA"` (text): Number of houses obtained on lease or rent under GPRA (as text) — *Samples: ["0","1","10","10258","104"]*
  - `"PH_Sanctioned_Strength"` (integer): Sanctioned number of police personnel for whom housing is planned

---

## 13. `"property_stolen_and_recovered"` (Property Crime - Stolen and Recovered)
- **Total Records:** 2397
- **Summary:** The table records annual counts and monetary values of property theft incidents across Indian states and union territories, broken down by crime group and sub‑group. Each row represents a specific Area, Year, Group and Sub‑Group, showing how many cases involved stolen property and how many resulted in recovery, along with their values. It enables analysis of theft trends, recovery rates, and financial impact by region, time, and crime type.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the Indian state or union territory — *Samples: ["Andaman & Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar"]*
  - `"Year"` (integer): Calendar year of the reported statistics — *Samples: [2001,2002,2003,2004,2005]*
  - `"Group_Name"` (text): Broad category of the property crime (e.g., Burglary - Property) — *Samples: ["Burglary - Property","Criminal Breach of Trust - Property","Dacoity -Property","Other heads of Property","Robbery - Property"]*
  - `"Sub_Group_Name"` (text): Specific sub‑category within the group — *Samples: ["1. Dacoity","2. Robbery","3. Burglary","4. Theft","5. Criminal Breach of Trust"]*
  - `"Cases_Property_Recovered"` (integer): Number of cases where stolen property was recovered
  - `"Cases_Property_Stolen"` (integer): Number of cases where property was reported stolen
  - `"Value_of_Property_Recovered"` (integer): Total monetary value of recovered property (in rupees)
  - `"Value_of_Property_Stolen"` (integer): Total monetary value of stolen property (in rupees)

---

## 14. `"serious_fraud"` (Financial Crime - Fraud)
- **Total Records:** 448
- **Summary:** The serious_fraud table records reported financial losses due to major fraud offenses, broken down by Indian state/union territory and fiscal year. It captures loss amounts in predefined monetary brackets (in Crores) for each fraud group and sub‑group, enabling analysis of regional fraud trends, year‑over‑year changes, and the distribution of loss sizes across different fraud types.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the Indian state or union territory — *Samples: ["Andaman & Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar"]*
  - `"Year"` (integer): Fiscal year of the reported fraud losses — *Samples: [2001,2002,2003,2004,2005]*
  - `"Group_Name"` (text): Broad category of fraud (e.g., Cheating, Criminal Breach of Trust) — *Samples: ["Serious Fraud - Cheating","Serious Fraud - Criminal Breach of Trust"]*
  - `"Sub_Group_Name"` (text): Specific sub‑category within the fraud group — *Samples: ["1. Criminal Breach of Trust","2. Cheating "]*
  - `"Loss_of_Property_1_10_Crores"` (integer): Number of cases with loss between 1 and 10 Crores
  - `"Loss_of_Property_10_25_Crores"` (integer): Number of cases with loss between 10 and 25 Crores
  - `"Loss_of_Property_25_50_Crores"` (integer): Number of cases with loss between 25 and 50 Crores
  - `"Loss_of_Property_50_100_Crores"` (integer): Number of cases with loss between 50 and 100 Crores
  - `"Loss_of_Property_Above_100_Crores"` (integer): Number of cases with loss above 100 Crores

---

## 15. `"specific_purpose_of_kidnapping_and_abduction"` (Violent Crime)
- **Total Records:** 3569
- **Summary:** The table records reported kidnapping and abduction cases in India, broken down by purpose (group), sub‑purpose, geographic area and year, and further disaggregated by gender and age brackets. It enables analysis of trends over time, regional differences, and the demographic profile of victims for each kidnapping motive.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the state or union territory — *Samples: ["Andaman & Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar"]*
  - `"Year"` (integer): Calendar year of the record — *Samples: [2001,2002,2003,2004,2005]*
  - `"Group_Name"` (text): Broad purpose category of the kidnapping (e.g., for adoption, begging) — *Samples: ["Kidnap - For Adoption","Kidnap - For Begging","Kidnap - For Camel Racing","Kidnap - For Illicit Intercourse","Kidnap - For Marriage"]*
  - `"Sub_Group_Name"` (text): Specific sub‑category code and description of the purpose — *Samples: ["01. For Adoption","02. For Begging","03. for Camel Racing","04. For Illicit Intercourse","05. For Marriage"]*
  - `"K_A_Cases_Reported"` (integer): Total number of kidnapping/abduction cases reported
  - `"K_A_Female_10_15_Years"` (integer): Female victims aged 10‑15 — *Samples: [0,1,2,3,4]*
  - `"K_A_Female_15_18_Years"` (integer): Female victims aged 15‑18 — *Samples: [0,1,2,3,4]*
  - `"K_A_Female_18_30_Years"` (integer): Female victims aged 18‑30 — *Samples: [0,1,2,3,4]*
  - `"K_A_Female_30_50_Years"` (integer): Female victims aged 30‑50 — *Samples: [0,1,2,3,4]*
  - `"K_A_Female_Above_50_Years"` (integer): Female victims older than 50 — *Samples: [0,1,2,3,4]*
  - `"K_A_Female_Total"` (integer): Total female victims across all ages
  - `"K_A_Female_Upto_10_Years"` (integer): Female victims up to 10 years old — *Samples: [0,1,2,3,4]*
  - `"K_A_Grand_Total"` (integer): Overall total victims (male + female)
  - `"K_A_Male_10_15_Years"` (integer): Male victims aged 10‑15 — *Samples: [0,1,2,3,4]*
  - `"K_A_Male_15_18_Years"` (integer): Male victims aged 15‑18 — *Samples: [0,1,2,3,4]*
  - `"K_A_Male_18_30_Years"` (integer): Male victims aged 18‑30 — *Samples: [0,1,2,3,4]*
  - `"K_A_Male_30_50_Years"` (integer): Male victims aged 30‑50 — *Samples: [0,1,2,3,4]*
  - `"K_A_Male_Above_50_Years"` (integer): Male victims older than 50 — *Samples: [0,1,2,3,4]*
  - `"K_A_Male_Total"` (integer): Total male victims across all ages
  - `"K_A_Male_Upto_10_Years"` (integer): Male victims up to 10 years old — *Samples: [0,1,2,3,4]*

---

## 16. `"trial_of_violent_crimes_by_courts"` (Violent Crime)
- **Total Records:** 4473
- **Summary:** The table records the number of violent crime cases that proceeded to trial in Indian courts, broken down by state/union territory (Area_name), year, and specific crime groups and sub‑groups. It distinguishes cases resolved by confession, by trial, and provides a total count. This enables analysis of regional trends, year‑over‑year changes, and the relative share of confessions versus full trials for various violent offenses.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the Indian state or union territory — *Samples: ["Andaman & Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar"]*
  - `"Year"` (integer): Calendar year of the recorded trial data — *Samples: [2001,2002,2003,2004,2005]*
  - `"Group_Name"` (text): Broad category of violent crime (e.g., TVC‑Arson) — *Samples: ["TVC- Arson","TVC- Attempt to Commit Murder","TVC- C.H. not Amounting to Murder","TVC- Dacoity","TVC- Dowry Deaths"]*
  - `"Sub_Group_Name"` (text): Specific sub‑category of the crime (e.g., 01. Murder) — *Samples: ["01. Murder","02. Attempt to Murder","03. C H Not Amounting to Murder","04. Rape","05. Kidnapping & Abduction"]*
  - `"Trial_of_Violent_Crimes_by_Courts_By_Confession"` (integer): Number of cases concluded by confession
  - `"Trial_of_Violent_Crimes_by_Courts_By_trial"` (integer): Number of cases that went to full trial
  - `"Trial_of_Violent_Crimes_by_Courts_Total"` (integer): Total number of violent crime cases recorded for the group/sub‑group

---

## 17. `"victims_of_rape"` (Crimes Against Women)
- **Total Records:** 1050
- **Summary:** The victims_of_rape table records annual rape-related statistics for each Indian area or state, broken down by victim age groups and sub‑categories of rape. It captures total reported cases, age‑specific victim counts, and distinguishes between total rape victims, incest rape victims, and other rape victims. This enables analysis of geographic and temporal trends, age‑group risk patterns, and comparisons across rape sub‑types.
- **Attributes:**
  - `"Area_name"` (character varying): Name of the Indian state, union territory, or area — *Samples: ["Andaman & Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar"]*
  - `"Year"` (integer): Calendar year of the reported data — *Samples: [2001,2002,2003,2004,2005]*
  - `"Subgroup"` (text): Category of victims (e.g., Total Rape Victims, Victims of Incest Rape, Victims of Other Rape) — *Samples: ["Total Rape Victims","Victims of Incest Rape","Victims of Other Rape"]*
  - `"Rape_Cases_Reported"` (integer): Number of rape cases reported in that area and year for the given subgroup
  - `"Victims_Above_50_Yrs"` (integer): Count of victims older than 50 years
  - `"Victims_Between_10-14_Yrs"` (integer): Count of victims aged 10 to 14 years
  - `"Victims_Between_14-18_Yrs"` (integer): Count of victims aged 14 to 18 years
  - `"Victims_Between_18-30_Yrs"` (integer): Count of victims aged 18 to 30 years
  - `"Victims_Between_30-50_Yrs"` (integer): Count of victims aged 30 to 50 years
  - `"Victims_of_Rape_Total"` (integer): Total number of victims of rape across all age groups for the subgroup
  - `"Victims_Upto_10_Yrs"` (integer): Count of victims aged 10 years or younger

---

