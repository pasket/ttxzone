---
format: "ttx-zone.scenario"
format_version: 3
language: "es"
title: "Ransomware en el laboratorio de análisis compartido"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Ransomware en el laboratorio de análisis compartido

La empresa privada que gestiona el laboratorio de {organization} y de otros hospitales sufre un ransomware. Los hospitales no están comprometidos, pero pierden un servicio sin el que no pueden trabajar: sin resultados de análisis ni pruebas cruzadas para transfusiones. Semanas después se publican datos de pacientes. El ejercicio pone a prueba la continuidad asistencial, la coordinación entre hospitales y la notificación a pacientes.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Atención crítica mantenida
- **OBJ-02** Una respuesta coordinada
- **OBJ-03** Pacientes informados

## Escenario

Lunes, 10:00. El proveedor del laboratorio deja de enviar resultados a la historia clínica de {organization}. Urgencias, quirófanos y oncología dependen de ellos.

## Fases e injects

### PH-01 Sin resultados

Lunes, 10:00. Los sistemas del proveedor del laboratorio están caídos.

- **INJ-01** (T+5′) El laboratorio no puede enviar resultados
- **INJ-02** (T+25′) Los cirujanos preguntan si operar
- **INJ-03** (T+40′) La autoridad sanitaria pide una única coordinación

### PH-02 Sangre y retrasos

Miércoles. Sin pruebas cruzadas; miles de citas que aplazar.

- **INJ-04** (T+55′) Solo sangre de donante universal
- **INJ-05** (T+85′) Otro laboratorio ofrece capacidad

### PH-03 Datos publicados

Dos semanas después. El proveedor se negó a pagar; se publican datos de pacientes.

- **INJ-06** (T+115′) Datos de pacientes en el sitio de filtraciones
- **INJ-07** (T+140′) ¿Han perjudicado los retrasos a los pacientes?

## Actores simulados

- **ACT-01** Proveedor crítico
- **ACT-02** Empleado
- **ACT-03** Autoridad competente
- **ACT-04** Proveedor de inteligencia de amenazas
- **ACT-05** Medios de comunicación

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Ransomware en el laboratorio de análisis compartido",
    "description": "La empresa privada que gestiona el laboratorio de {organization} y de otros hospitales sufre un ransomware. Los hospitales no están comprometidos, pero pierden un servicio sin el que no pueden trabajar: sin resultados de análisis ni pruebas cruzadas para transfusiones. Semanas después se publican datos de pacientes. El ejercicio pone a prueba la continuidad asistencial, la coordinación entre hospitales y la notificación a pacientes."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "annual_program"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "continuity_recovery",
      "cross_unit_coordination",
      "regulatory_notification"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Comité de crisis",
      "Dirección médica",
      "Urgencias",
      "Servicios de laboratorio",
      "Comunicación",
      "Delegado de protección de datos",
      "Legal",
      "Dirección gerente",
      "Responsable de comunicación",
      "Responsable de servicios de laboratorio"
    ],
    "third_parties": [
      "Proveedor del laboratorio",
      "Centro de transfusión"
    ],
    "perimeter": "Los servicios clínicos que dependen del laboratorio, la coordinación con otros hospitales y centros de salud, y la comunicación con pacientes.",
    "out_of_scope": "La recuperación del propio proveedor del laboratorio.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "WHITE COAT",
    "needs": [
      {
        "code": "NEED-01",
        "source": "risk_analysis",
        "title": "Sin alternativa al laboratorio externalizado",
        "finding": "El hospital ya no tiene capacidad de laboratorio propia.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Coordinación entre hospitales sin ensayar",
        "finding": "Hospitales, centros de salud y el centro de transfusión nunca han gestionado juntos una caída compartida.",
        "affected_capability": "cross_unit_coordination",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Notificación a pacientes por una brecha del proveedor sin ensayar",
        "finding": "Nadie ha acordado quién informa a los pacientes cuando la brecha de un encargado expone sus datos.",
        "affected_capability": "regulatory_notification",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Atención crítica mantenida",
        "statement": "Urgencias y oncología siguen con resultados por teléfono y en papel; lo no urgente se aplaza con criterios claros; se incorporan laboratorios alternativos.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Incidente crítico declarado\nCriterios de aplazamiento acordados\nLaboratorio alternativo incorporado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de decisiones clínicas.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Una respuesta coordinada",
        "statement": "Hospitales, centros de salud y el centro de transfusión actúan desde una única célula de coordinación y hablan con una sola voz.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Célula de coordinación creada\nPortavoz único acordado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Actas de coordinación.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Pacientes informados",
        "statement": "Cuando se publican los datos, el hospital decide su notificación y cómo informa y atiende a los pacientes.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Notificación decidida\nLínea de atención a pacientes creada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de la brecha y aviso a pacientes.",
        "regulatory_requirement_ids": [
          "GDPR-33-34"
        ]
      }
    ],
    "risks": [
      {
        "risk": "Ocurre un incidente real durante la sesión.",
        "mitigation": "Cualquiera puede detener el ejercicio con la palabra clave de parada."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 4
  },
  "msel": {
    "title": "Sin resultados",
    "summary": "Lunes, 10:00. El proveedor del laboratorio deja de enviar resultados a la historia clínica de {organization}. Urgencias, quirófanos y oncología dependen de ellos.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Sin resultados",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Lunes, 10:00. Los sistemas del proveedor del laboratorio están caídos.",
        "key_questions": [
          "¿Qué atención sigue adelante sin resultados?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          },
          {
            "code": "OBJ-02",
            "due": false
          }
        ],
        "headline": "El laboratorio deja de responder"
      },
      {
        "code": "PH-02",
        "name": "Sangre y retrasos",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 2880,
        "situation_update": "Miércoles. Sin pruebas cruzadas; miles de citas que aplazar.",
        "key_questions": [
          "¿Quién coordina y quién habla?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-02",
            "due": true
          }
        ],
        "headline": "Solo sangre de donante universal"
      },
      {
        "code": "PH-03",
        "name": "Datos publicados",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 20160,
        "situation_update": "Dos semanas después. El proveedor se negó a pagar; se publican datos de pacientes.",
        "key_questions": [
          "¿Cómo informamos a los pacientes y qué apoyo les damos?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Los datos de pacientes están en internet"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Grupo de ransomware",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Grupo de ransomware sin identificar que cifró y robó datos del proveedor del laboratorio.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1567.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1486"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1490"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1657"
          }
        ]
      }
    ],
    "injects": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-01",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "El laboratorio no puede enviar resultados",
        "content": "El proveedor del laboratorio: un ataque de ransomware ha cifrado sus sistemas de laboratorio. No puede recibir peticiones ni enviar resultados, y no tiene una estimación de recuperación.",
        "offset_minutes": 5,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-01",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Dirección médica",
          "Comité de crisis"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1486"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Declara un incidente crítico y pasa los análisis urgentes a teléfono y papel.",
            "responsible_role": "Dirección médica",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Los cirujanos preguntan si operar",
        "content": "Urgencias tiene pacientes esperando resultados, y la jefatura de cirugía pregunta si las operaciones de esta tarde siguen adelante sin análisis de sangre.",
        "offset_minutes": 25,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-02",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Dirección médica",
          "Urgencias"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Decide qué cirugías y procedimientos siguen adelante.",
            "responsible_role": "Dirección médica",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "La autoridad sanitaria pide una única coordinación",
        "content": "La autoridad sanitaria regional: todos los hospitales y centros de salud que usan el proveedor están afectados. Propone una única célula de coordinación con el centro de transfusión.",
        "offset_minutes": 40,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-03",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Comité de crisis",
          "Dirección gerente"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Se integra en una única célula de coordinación con los demás hospitales, centros de salud y el centro de transfusión.",
            "responsible_role": "Dirección gerente",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Solo sangre de donante universal",
        "content": "La responsable de transfusión: sin pruebas cruzadas solo se puede usar sangre de donante universal y las reservas durarán dos días. El centro de transfusión quiere lanzar un llamamiento público a donantes.",
        "offset_minutes": 55,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-02",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Dirección médica",
          "Responsable de comunicación"
        ],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01",
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Limita las transfusiones a los casos imprescindibles.",
            "responsible_role": "Dirección médica",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-04-A2",
            "description": "Acuerda el llamamiento a donantes y un portavoz único para todos los hospitales.",
            "responsible_role": "Responsable de comunicación",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Otro laboratorio ofrece capacidad",
        "content": "Servicios de laboratorio: hay que aplazar esta semana 3.000 consultas y 800 operaciones. Otro laboratorio ofrece parte de su capacidad, pero sin integración con vuestra historia clínica.",
        "offset_minutes": 85,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-02",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Servicios de laboratorio",
          "Dirección médica"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Acuerda con el laboratorio alternativo cómo circulan las muestras y los resultados.",
            "responsible_role": "Responsable de servicios de laboratorio",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Datos de pacientes en el sitio de filtraciones",
        "content": "El proveedor de inteligencia de amenazas: tras la negativa del proveedor a pagar, el grupo ha publicado unos 400 GB con nombres de pacientes, resultados e identificadores, incluidos los de vuestros pacientes.",
        "offset_minutes": 115,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-04",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Delegado de protección de datos",
          "Legal"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1567.002"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Decide la notificación y cómo se informa y atiende a los pacientes.",
            "responsible_role": "Delegado de protección de datos",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-07",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "¿Han perjudicado los retrasos a los pacientes?",
        "content": "Una periodista de salud pregunta si algún paciente ha sufrido daños por los retrasos y por qué los hospitales dependen de un único proveedor privado.",
        "offset_minutes": 140,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-05",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Responsable de comunicación",
          "Dirección médica"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Aprueba un comunicado conjunto con los demás hospitales.",
            "responsible_role": "Responsable de comunicación",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-07-A2",
            "description": "Abre una línea de atención para pacientes preocupados.",
            "responsible_role": "Delegado de protección de datos",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      }
    ],
    "next_phase_number": 4,
    "next_inject_number": 8,
    "next_threat_actor_number": 2
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "critical-supplier",
      "origin_name": "Proveedor crítico",
      "code": "ACT-01",
      "name": "Proveedor crítico",
      "type": "supplier",
      "description": "Un proveedor del que depende el negocio, afectado o implicado en el incidente.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Empleado",
      "code": "ACT-02",
      "name": "Empleado",
      "type": "internal",
      "description": "Un empleado que avisa de algo extraño, o el insider que está detrás.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "competent-authority",
      "origin_name": "Autoridad competente",
      "code": "ACT-03",
      "name": "Autoridad competente",
      "type": "authority",
      "description": "La autoridad de ciberseguridad a la que la organización notifica los incidentes.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "threat-intel-provider",
      "origin_name": "Proveedor de inteligencia de amenazas",
      "code": "ACT-04",
      "name": "Proveedor de inteligencia de amenazas",
      "type": "supplier",
      "description": "Vigila foros, sitios de filtraciones y redes: avisa de datos expuestos y de la actividad del atacante.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Medios de comunicación",
      "code": "ACT-05",
      "name": "Medios de comunicación",
      "type": "media",
      "description": "Periodistas que preguntan o publican sobre el incidente.",
      "channel": "media"
    }
  ],
  "next_actor_number": 6,
  "tags": [
    {
      "origin": "system",
      "origin_id": "ransomware",
      "origin_name": "Ransomware",
      "name": "Ransomware",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "supply-chain",
      "origin_name": "Cadena de suministro",
      "name": "Cadena de suministro",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "crisis-committee",
      "origin_name": "Comité de crisis",
      "name": "Comité de crisis",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "gdpr",
      "origin_name": "RGPD",
      "name": "RGPD",
      "color": "slate",
      "custom_hex": null,
      "applied": true
    }
  ],
  "images": [],
  "uses_rooms": false,
  "rooms": [],
  "next_room_number": 1
}
```
