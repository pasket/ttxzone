---
format: "ttx-zone.scenario"
format_version: 1
language: "es"
title: "Ejercicio ejecutivo: acceso de confianza"
exported_at: "2026-10-12T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Ejercicio ejecutivo: acceso de confianza

Este es un ejercicio de mesa ejecutivo. Simula una crisis cibernética de alto impacto que golpea a una empresa global en distintos países y entornos a la vez. El escenario empieza con el compromiso de un proveedor de TI, escala a una fuga de datos a gran escala y termina con un ataque de ransomware que interrumpe tanto los entornos corporativos como los operacionales (OT), con una mezcla de actores de amenaza estatales y cibercriminales. El ejercicio no evalúa la contención técnica. Su propósito es entrenar a la alta dirección para gobernar una crisis transfronteriza bajo incertidumbre. Eso significa tomar decisiones críticas bajo presión, aclarar roles, autoridad y vías de escalado, probar la coordinación entre países y áreas de negocio, gestionar reguladores, accionistas, medios y clientes, y poner al descubierto las carencias del gobierno de crisis. El mensaje clave para el Consejo es sencillo: un incidente cibernético ya no es un problema de TI. Es un problema de gobierno.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Criterios de escalado a crisis de Grupo
- **OBJ-02** Decisiones con responsable, plazo y justificación
- **OBJ-03** Decisión de aislamiento de la OT
- **OBJ-04** Mando único entre entidades
- **OBJ-05** Matriz de notificaciones y declaración de espera común

## Escenario

Es **domingo 3 de mayo, 08:00**. Una mañana tranquila de fin de semana en todo el Grupo: {group_name} (funciones de Grupo), {company_1} y {company_2}.

Durante la noche, el Centro de Operaciones de Seguridad del Grupo ha detectado **actividad de inicio de sesión inusual** vinculada a un contratista de **{supplier}**, el proveedor de servicios de TI del Grupo, con **acceso privilegiado en todo el Grupo** en {country_1} y {country_2}.

El Equipo de Gestión de Crisis acaba de recibir una **notificación formal de incidente** y la petición de una **llamada de emergencia en la próxima hora**. _La información es incompleta y seguirá cambiando._

Tu papel es **dirigir la respuesta del Grupo como lo harías en un día real**, con tus planes, tu autoridad y tus procesos actuales. Acepta el escenario tal como se presenta y **céntrate en las decisiones que solo tú puedes tomar**.

## Fases e injects

### PH-01 Escalado inicial

Domingo 3 de mayo, 08:00. A las 05:00 el SOC detectó una alerta de «viaje imposible»: {person_1}, contratista de {supplier}, inició sesión desde {country_1} y 25 minutos después desde otro país, con una contraseña que aparece en una base de datos de brechas conocida. Aparecen alertas similares en otras cuentas de {supplier}. {supplier} admite que sufrió una brecha hace seis meses y nunca nos lo dijo. Los atacantes podrían tener acceso a la TI corporativa en {country_1} y {country_2}, incluido el despliegue de portátiles {project_1} (2.600 equipos). El CISO del Grupo ha notificado formalmente al Equipo de Gestión de Crisis y ha pedido una llamada de emergencia en la próxima hora.

- **INJ-01** (T+0′) Petición de activación de Gestión de Crisis – actividad sospechosa en cuentas de {supplier}
- **INJ-12** (contingente) {supplier} – petición de un único punto de contacto

### PH-02 Compromiso de datos

Se ha activado el retainer de respuesta a incidentes de {ir_provider}. El análisis forense confirma que la cuenta comprometida se usó para exfiltrar de forma encubierta unos 100 GB durante seis meses: documentos legales confidenciales de {group_name} (planes de M&A, informes de cumplimiento), datos personales de clientes de {company_2} y de {company_1}, y diagramas de la red SCADA de {business_d}. No se ha detectado ninguna fuga pública. Se desconocen el alcance total y la intención del atacante, y el riesgo de extorsión es alto.

- **INJ-02** (T+15′) {ir_provider} IR – 100 GB exfiltrados durante seis meses

### PH-03 Ransomware y crisis de OT

El ransomware golpea {country_1} y {country_2} a la vez. Los sistemas de TI están caídos en ambos países, incluidos los 2.600 portátiles {project_1} que gestionaba {person_1}. {control_centre_1} ha perdido la conexión con tres plantas renovables: el ataque ha pasado a la OT. La conmutación a respaldo no está confirmada y se desconoce la integridad de las copias de seguridad. Rescate exigido: 20 M€ en 48 horas. El SOC advierte de que {business_d} y {business_b} podrían ser los siguientes en cifrarse. Ningún equipo tiene visibilidad completa de la TI y la OT.

- **INJ-03** (T+30′) Ransomware en {country_1} y {country_2} – OT afectada, rescate de 20 M€
- **INJ-13** (contingente) Sala de control de {business_d} – instrucciones contradictorias, decisión inmediata

### PH-04 Presión pública y regulatoria

La crisis ya es pública. El CSIRT nacional de {country_1} pide una notificación formal del incidente, el alcance del impacto y pruebas de la contención. {grid_operator} quiere garantías inmediatas de que la estabilidad de la red no está en riesgo y avisa de que las decisiones de {business_d} se juzgarán desde la perspectiva del interés nacional. Los clientes de {country_1} y {country_2} presentan reclamaciones y amenazan con penalizaciones contractuales. Los accionistas exigen explicaciones a través de Relación con Inversores y de los canales del Consejo. Los mensajes de {country_1} y {country_2} aún no están alineados.

- **INJ-04** (T+50′) CSIRT nacional ({country_1}) – petición formal de notificación del incidente
- **INJ-05** (T+52′) Sala de control de {grid_operator} – garantías sobre la estabilidad de la red
- **INJ-06** (T+55′) Relación con Inversores – reclamaciones de clientes y presión de los accionistas

### PH-05 Atribución: un actor estatal se une al eCrime

{ir_provider} ha entregado un análisis de causa raíz. Hace seis meses, PIONEER KITTEN, un grupo estatal alineado con Irán, explotó el appliance VPN de {supplier} y mantuvo un acceso prolongado. Esta semana, ese acceso se vendió o se cedió a SCATTERED SPIDER, un grupo criminal que desplegó el ransomware y exigió los 20 M€. Actores patrocinados por un Estado lo hicieron posible; criminales lo ejecutaron.

- **INJ-07** (T+65′) Atribución – un actor estatal se une al eCrime

### PH-06 Fuga de datos

Nuestro servicio de vigilancia de la dark web ha encontrado un volcado de «prueba de vida» en un conocido sitio de filtraciones. El SOC/CSIRT del Grupo y los CSIRT de {country_1} y {country_2} han confirmado que las muestras son auténticas: registros de clientes ({group_name} y {company_2}), documentos corporativos confidenciales y diagramas SCADA que mencionan {business_d}. En pocas horas, los medios de {country_1} y {country_2} lo publican: datos de clientes expuestos, diagramas de infraestructuras críticas filtrados, un ataque vinculado a un Estado.

- **INJ-08** (T+75′) Volcado de «prueba de vida» confirmado en un sitio de filtraciones
- **INJ-09** (T+80′) Los medios de {country_1} y {country_2} publican la fuga

### PH-07 Decisión ejecutiva

Todas las copias de seguridad están comprometidas; el último punto de recuperación limpio es una copia en cinta de hace seis meses. Opción 1, pagar 20 M€: 2–3 días para recuperar, sin garantías, posible exposición a sanciones, sienta un precedente. Opción 2, reconstruir en limpio: 14–21 días, entorno limpio garantizado, coste alto y presión sostenida. Opción 3, híbrida: 10–14 días, restauración selectiva, riesgo residual, más difícil de explicar a reguladores y medios. Se acerca el plazo del rescate.

- **INJ-10** (T+95′) Se requiere una decisión ejecutiva – opciones de recuperación
- **INJ-14** (contingente) Mensaje del atacante – quedan 6 horas, amenaza a {control_centre_1}

### PH-08 Reflexión posterior al incidente

Martes 5 de mayo, 14:00. La fase de respuesta a la crisis ha terminado y la recuperación está en marcha. Reflexiona sobre tu propio liderazgo, la toma de decisiones y el gobierno durante este ejercicio, no sobre la respuesta técnica u operativa.

- **DSC-11** (T+120′) Posincidente – reflexión ejecutiva

## Actores simulados

- **ACT-08** CISO del Grupo
- **ACT-09** SOC del Grupo
- **ACT-10** {ir_provider} IR
- **ACT-02** CSIRT nacional ({country_1})
- **ACT-03** {grid_operator}
- **ACT-11** Relación con Inversores
- **ACT-04** Medios ({country_1} y {country_2})
- **ACT-12** Consejo de Administración
- **ACT-05** {supplier}
- **ACT-13** Sala de control de {business_d}
- **ACT-07** Scattered Spider

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 1,
  "language": "es",
  "exported_at": "2026-10-12T00:00:00Z",
  "exercise": {
    "name": "Ejercicio ejecutivo: acceso de confianza",
    "description": "Este es un ejercicio de mesa ejecutivo. Simula una crisis cibernética de alto impacto que golpea a una empresa global en distintos países y entornos a la vez. El escenario empieza con el compromiso de un proveedor de TI, escala a una fuga de datos a gran escala y termina con un ataque de ransomware que interrumpe tanto los entornos corporativos como los operacionales (OT), con una mezcla de actores de amenaza estatales y cibercriminales. El ejercicio no evalúa la contención técnica. Su propósito es entrenar a la alta dirección para gobernar una crisis transfronteriza bajo incertidumbre. Eso significa tomar decisiones críticas bajo presión, aclarar roles, autoridad y vías de escalado, probar la coordinación entre países y áreas de negocio, gestionar reguladores, accionistas, medios y clientes, y poner al descubierto las carencias del gobierno de crisis. El mensaje clave para el Consejo es sencillo: un incidente cibernético ya no es un problema de TI. Es un problema de gobierno."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "annual_program",
      "new_or_revised_plan",
      "regulatory"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2",
      "GDPR",
      "CER",
      "NCCS",
      "UK_NIS"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "detection_triage_escalation",
      "crisis_decision_making",
      "internal_external_comms",
      "cross_unit_coordination"
    ],
    "levels": [
      "strategic"
    ],
    "participating_areas": [
      "Dirección ejecutiva del Grupo",
      "Finanzas del Grupo",
      "Secretaría General y del Consejo",
      "Negocio de Clientes del Grupo",
      "Redes del Grupo",
      "Generación del Grupo",
      "TI del Grupo",
      "Seguridad del Grupo",
      "Ciberseguridad del Grupo",
      "Dirección de {company_1}",
      "Comunicación Externa ({country_1})",
      "Dirección de {company_2}",
      "{business_d}",
      "{business_e}"
    ],
    "third_parties": [],
    "perimeter": "- Entidades: {group_name} (funciones de Grupo); {company_1} ({business_a}, {business_b}, {business_c}); {company_2} (negocio de Clientes, {business_d}, {business_e}).\n- Países: {country_1} y {country_2}.\n- Sistemas (a nivel de impacto en el negocio): TI corporativa, datos de clientes y OT que soporta las redes de distribución y la generación, además del proveedor de TI comprometido ({supplier}).\n- Procesos: escalado y activación de crisis, toma de decisiones ejecutivas, coordinación entre entidades, notificación regulatoria y comunicación con medios, clientes, inversores y autoridades.",
    "out_of_scope": "- Contención técnica, análisis forense, erradicación y recuperación de los sistemas de TI y OT.\n- Procedimientos operativos del SOC/CSIRT y herramientas de seguridad.\n- Negocios y países del Grupo fuera de {country_1} y {country_2} (el resto de la presencia del grupo).\n- Contacto real con reguladores, autoridades, el proveedor o los medios (todos simulados por los facilitadores).\n- Tácticas de negociación del rescate y mecánica del pago.\n- Evaluación del desempeño individual (el ejercicio evalúa a la organización, no a las personas).",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "- El escenario, los injects y la ruta de ataque son confidenciales: solo se comparten con los facilitadores y el equipo de control del ejercicio hasta la sesión.\n- Los participantes no reciben detalles del escenario por adelantado.\n- No se usan vulnerabilidades reales, IOCs, datos de clientes ni información de incidentes reales. El proveedor ({supplier}) y todas las partes externas son ficticios o simulados.\n- Los resultados de la sesión (registros de decisiones, notas de observadores, informe posterior) se clasifican como [Confidencial / TLP:AMBER+STRICT] y solo se distribuyen a los participantes y a las partes interesadas del Grupo designadas.\n- Es deseable grabar el audio para la evaluación posterior.\n- El informe evalúa a la organización, no a las personas. Sin atribución del desempeño individual.\n- {ir_provider} trabaja bajo el acuerdo de confidencialidad / de servicios existente.",
    "budget_and_external_support": "- Apoyo externo: {ir_provider} diseña y facilita el ejercicio (facilitador principal: {person_2}; cofacilitadora: {person_3}), con apoyo interno de facilitación del Centro de Operaciones de Seguridad del Grupo.\n- Presupuesto: parte de los servicios incluidos en el retainer de respuesta a incidentes de {ir_provider}. Salvo los gastos, que se facturarán aparte.",
    "stop_exercise_keyword": "MUNDO REAL",
    "needs": [
      {
        "code": "NEED-01",
        "source": "incident_history",
        "title": "Toma de decisiones transversal y rendición de cuentas",
        "finding": "Cuando intervienen Legal, Comunicación, Redes, Clientes, TI y Finanzas, no está claro quién decide, a quién se consulta y quién responde del resultado. Eso retrasa o diluye decisiones clave como pagar un rescate, desconectar la OT o notificar a los reguladores.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Respuesta coordinada entre países",
        "finding": "Cada país sigue sus propios procesos y trata con sus propios reguladores. No hay una única cadena de mando ni un relato unificado. Esto crea el riesgo de mensajes y decisiones contradictorios ante reguladores y medios.",
        "affected_capability": "cross_unit_coordination",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "incident_history",
        "title": "Vías de escalado y umbral de crisis",
        "finding": "No hay una definición clara de cuándo un incidente pasa a ser una crisis de Grupo ni de quién activa ese cambio. Esto retrasa la implicación de la alta dirección.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-04",
        "source": "incident_history",
        "title": "Decisiones de negocio en incidentes de TI/OT",
        "finding": "La dirección no tiene criterios acordados para decidir si aislar o mantener en marcha los sistemas de red y de generación cuando un ataque se extiende de la TI a la OT. Están en juego la seguridad, la continuidad del suministro y la exposición regulatoria.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-05",
        "source": "regulatory",
        "title": "Notificación regulatoria y gestión de partes interesadas",
        "finding": "Plazos y mensajes. Los plazos de notificación (NIS2, reguladores locales, protección de datos) deben cumplirse en paralelo, con información incompleta, mientras se gestiona a accionistas, medios y clientes. Esto genera riesgo regulatorio y reputacional.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      },
      {
        "code": "NEED-06",
        "source": "incident_history",
        "title": "Toma de decisiones bajo incertidumbre",
        "finding": "Actuar sin todos los datos. La dirección tiende a esperar certeza técnica antes de decidir y, en una crisis, eso supone perder la ventana para actuar. Además, las decisiones tienen que poder defenderse después.",
        "affected_capability": "crisis_decision_making",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Criterios de escalado a crisis de Grupo",
        "statement": "Los participantes aplican criterios explícitos para decidir si el incidente pasa a ser una crisis de Grupo, nombran quién (por rol) activa la respuesta y establecen a quién hay que informar a nivel de Grupo, en {country_1} y en {country_2}.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-03",
          "NEED-06"
        ],
        "success_criterion": "Se toma una decisión de escalado\nSe nombra un único rol como el que activa la respuesta\nSe explicitan los criterios usados (de la política existente o acordados en el momento)",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "Las tres condiciones se cumplen antes de que termine PH-01.",
        "partially_achieved": "Se toma una decisión pero el rol que activa o los criterios no están claros, o el responsable solo se nombra después del inject contingente en el que {supplier} pide un único punto de contacto",
        "not_achieved": "Ninguna decisión de escalado antes de que termine PH-01",
        "evidence": "Hora del inject y de la decisión, el rol nombrado como activador, los criterios citados (y si vienen de una política existente), las partes informadas y notas de los observadores sobre dudas o disputas de responsabilidad.",
        "regulatory_requirement_ids": [
          "NIS2-21-2-C",
          "ISO27001-A5-24",
          "ISO27035-2",
          "UK-NIS-CAF-D1"
        ]
      },
      {
        "code": "OBJ-02",
        "title": "Decisiones con responsable, plazo y justificación",
        "statement": "El comité de crisis toma cada decisión clave con un único responsable nombrado, dentro de su plazo y con una justificación documentada, aunque la información sea incompleta. Las decisiones clave de este ejercicio son: (1) la posición ante el rescate, (2) la comunicación pública de la fuga de datos y (3) la notificación y colaboración con las fuerzas de seguridad y las autoridades nacionales.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-01",
          "NEED-06"
        ],
        "success_criterion": "Responsable: una única persona nombrada (por rol) responde de la decisión. Un comité o un grupo de funciones no cuenta.\nPlazo: la decisión se toma antes de que termine la fase en la que vence (fuerzas de seguridad: PH-05; comunicación pública: PH-06; rescate: PH-07).\nJustificación: se explicitan y registran los motivos y los principales supuestos sobre la información que falta.\nAplazamiento: una decisión solo puede aplazarse si tiene un responsable nombrado, una fecha concreta y la información necesaria para decidir. Un aplazamiento sin fecha cuenta como no logrado.",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "Solo si las tres decisiones clave cumplen todas las condiciones.",
        "partially_achieved": "2 de 3 decisiones cumplen todas las condiciones",
        "not_achieved": "1 o ninguna",
        "evidence": "Registro de decisiones completado por el observador para cada decisión clave. Recoge: inject que la desencadena y hora, decisión tomada (o términos del aplazamiento), responsable, funciones consultadas, justificación, supuestos y tiempo transcurrido. Los observadores anotan también cualquier desacuerdo sobre la responsabilidad y cómo se resolvió.",
        "regulatory_requirement_ids": [
          "NIS2-21-2-C",
          "NCCS-CRISIS",
          "ISO22301-8-5",
          "CER-13"
        ]
      },
      {
        "code": "OBJ-03",
        "title": "Decisión de aislamiento de la OT",
        "statement": "La dirección decide si aislar o mantener en marcha los sistemas de red y de generación, valorando explícitamente la seguridad, la continuidad del suministro y la exposición regulatoria, y el responsable de negocio de la OT (Redes/Generación) asume formalmente la decisión.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-01",
          "NEED-04"
        ],
        "success_criterion": "Se toma una decisión (aislar, aislar parcialmente o mantener en marcha)\nLa asume el responsable de negocio de la OT correspondiente, por rol\nSe tratan explícitamente las tres dimensiones",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "Las tres condiciones se cumplen antes de que termine PH-03.",
        "partially_achieved": "Se toma una decisión pero se ignora una dimensión, el responsable no está claro o la decisión solo llega tras el inject contingente en el que la sala de control de {business_d} pide una decisión de negocio",
        "not_achieved": "Ninguna decisión, o la decisión se deja solo en manos de TI/Seguridad",
        "evidence": "Registro de la decisión con la opción elegida, el responsable, los compromisos valorados en cada dimensión, las condiciones para revertirla, las opiniones discrepantes y el tiempo transcurrido.",
        "regulatory_requirement_ids": [
          "NIS2-21-2-C",
          "NCCS-CRISIS",
          "CER-13",
          "UK-NIS-CAF-D1"
        ]
      },
      {
        "code": "OBJ-04",
        "title": "Mando único entre entidades",
        "statement": "{group_name} (funciones de Grupo), {company_1} y {company_2} acuerdan una única cadena de mando, una posición común y una cadencia de coordinación, mientras cada entidad cumple sus obligaciones regulatorias locales.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Se nombra por rol un único responsable a nivel de Grupo antes de que termine PH-01\nSe explicitan los derechos de decisión de cada entidad (qué se decide localmente y qué en el Grupo) antes de que termine PH-04\nSe acuerda una cadencia de coordinación antes de que termine PH-04\nNo hay decisiones ni mensajes contradictorios entre entidades durante el resto del ejercicio",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "Los plazos van ligados a las fases, como indica cada condición.",
        "partially_achieved": "Estructura acordada, pero después se producen una o más contradicciones",
        "not_achieved": "No se acuerda un responsable único",
        "evidence": "La estructura de mando tal como la expresan los participantes, los derechos de decisión de cada entidad, la cadencia acordada y un registro del observador de cada contradicción entre entidades (con la hora y cómo se resolvió).",
        "regulatory_requirement_ids": [
          "NIS2-21-2-C",
          "NCCS-CRISIS",
          "UK-NIS-CAF-D1"
        ]
      },
      {
        "code": "OBJ-05",
        "title": "Matriz de notificaciones y declaración de espera común",
        "statement": "El comité identifica todas las notificaciones aplicables (reguladores de todos los países afectados, autoridades de protección de datos) con responsables y plazos, y aprueba una declaración de espera coherente para medios, clientes e inversores.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-05",
          "NEED-06"
        ],
        "success_criterion": "Una matriz de notificaciones cubre cada régimen aplicable con su responsable por rol, su plazo y cuándo empieza a contar\nUna única declaración de espera es aprobada por un rol nombrado y la usan todas las entidades",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "Ambas condiciones se cumplen antes de que termine PH-06.",
        "partially_achieved": "Matriz incompleta (falta uno o más regímenes) o declaración no alineada entre entidades",
        "not_achieved": "Sin matriz o sin declaración aprobada",
        "evidence": "Matriz de notificaciones (régimen, autoridad, responsable, plazo, inicio del cómputo), borrador de la declaración de espera, hora de aprobación y quién la aprueba, y notas de los observadores sobre regímenes olvidados o plazos mal calculados.\nLista de referencia con la que los observadores comparan la matriz: NIS2 (alerta temprana en 24 h / notificación en 72 h), UK NIS (72 h), RGPD / UK GDPR (72 h, más los interesados), CER (24 h).",
        "regulatory_requirement_ids": [
          "NIS2-23",
          "GDPR-33-34",
          "CER-15",
          "UK-NIS-11"
        ]
      }
    ],
    "risks": [
      {
        "risk": "Filtración del escenario",
        "mitigation": "Comparte el escenario solo con el equipo de planificación hasta la sesión. Marca todos los materiales como «EJERCICIO – CONFIDENCIAL»."
      },
      {
        "risk": "Ausencia de decisores clave",
        "mitigation": "Confirma la asistencia a través de los asistentes de dirección 2 semanas antes. Cualquier sustituto debe tener autoridad real para decidir, y su asistencia se recoge en el informe."
      },
      {
        "risk": "Un incidente real coincide con el ejercicio",
        "mitigation": "Cualquiera dice «MUNDO REAL» y el ejercicio se detiene. El SOC del Grupo vigila las operaciones durante la sesión y tiene línea directa con el CISO."
      },
      {
        "risk": "La sesión se alarga más allá de sus fases (PH-05 dura solo 10 minutos)",
        "mitigation": "Los facilitadores se ciñen al guion, cierran cada fase con su pregunta clave y aparcan los temas abiertos para el debriefing."
      },
      {
        "risk": "La discusión deriva hacia el detalle técnico (contención, forense), que queda fuera del alcance",
        "mitigation": "Los facilitadores reconducen a la decisión ejecutiva en juego; las preguntas técnicas van a un «aparcamiento» que se responde en el debriefing."
      },
      {
        "risk": "Los participantes cuestionan el realismo del escenario",
        "mitigation": "La sesión informativa inicial fija las reglas: aceptar el escenario tal como se presenta, entorno sin culpas, centrarse en las decisiones que solo puede tomar la dirección."
      },
      {
        "risk": "Grabaciones de audio o notas salen de la distribución controlada",
        "mitigation": "Graba solo con un consentimiento anunciado al inicio; guarda grabaciones y notas como TLP:AMBER+STRICT y bórralas en cuanto se apruebe el informe posterior."
      }
    ],
    "next_need_number": 7,
    "next_objective_number": 6
  },
  "msel": {
    "title": "Acceso de confianza",
    "summary": "Es **domingo 3 de mayo, 08:00**. Una mañana tranquila de fin de semana en todo el Grupo: {group_name} (funciones de Grupo), {company_1} y {company_2}.\n\nDurante la noche, el Centro de Operaciones de Seguridad del Grupo ha detectado **actividad de inicio de sesión inusual** vinculada a un contratista de **{supplier}**, el proveedor de servicios de TI del Grupo, con **acceso privilegiado en todo el Grupo** en {country_1} y {country_2}.\n\nEl Equipo de Gestión de Crisis acaba de recibir una **notificación formal de incidente** y la petición de una **llamada de emergencia en la próxima hora**. _La información es incompleta y seguirá cambiando._\n\nTu papel es **dirigir la respuesta del Grupo como lo harías en un día real**, con tus planes, tu autoridad y tus procesos actuales. Acepta el escenario tal como se presenta y **céntrate en las decisiones que solo tú puedes tomar**.",
    "attack_version": "19.2",
    "duration_minutes": 140,
    "time_compression": 5,
    "phases": [
      {
        "code": "PH-01",
        "name": "Escalado inicial",
        "start_offset": 0,
        "end_offset": 15,
        "incident_jump_minutes": 0,
        "situation_update": "Domingo 3 de mayo, 08:00. A las 05:00 el SOC detectó una alerta de «viaje imposible»: {person_1}, contratista de {supplier}, inició sesión desde {country_1} y 25 minutos después desde otro país, con una contraseña que aparece en una base de datos de brechas conocida. Aparecen alertas similares en otras cuentas de {supplier}. {supplier} admite que sufrió una brecha hace seis meses y nunca nos lo dijo. Los atacantes podrían tener acceso a la TI corporativa en {country_1} y {country_2}, incluido el despliegue de portátiles {project_1} (2.600 equipos). El CISO del Grupo ha notificado formalmente al Equipo de Gestión de Crisis y ha pedido una llamada de emergencia en la próxima hora.",
        "key_questions": [
          "¿Es una crisis según nuestro Plan de Gestión de Crisis? ¿Con qué gravedad?",
          "¿Quién dirige la respuesta en {country_1} y {country_2}: el CISO, el CSO o el CIO?",
          "¿A quién hay que avisar ahora y por qué canal?",
          "¿Cortamos de inmediato todo el acceso de {supplier}, sabiendo el impacto operativo?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-04",
            "due": true
          }
        ]
      },
      {
        "code": "PH-02",
        "name": "Compromiso de datos",
        "start_offset": 15,
        "end_offset": 30,
        "incident_jump_minutes": 0,
        "situation_update": "Se ha activado el retainer de respuesta a incidentes de {ir_provider}. El análisis forense confirma que la cuenta comprometida se usó para exfiltrar de forma encubierta unos 100 GB durante seis meses: documentos legales confidenciales de {group_name} (planes de M&A, informes de cumplimiento), datos personales de clientes de {company_2} y de {company_1}, y diagramas de la red SCADA de {business_d}. No se ha detectado ninguna fuga pública. Se desconocen el alcance total y la intención del atacante, y el riesgo de extorsión es alto.",
        "key_questions": [
          "¿Cambia esto la gravedad? ¿Quién preside el Equipo de Gestión de Crisis?",
          "¿Notificamos a los reguladores de forma preventiva o esperamos a que haya una fuga pública?",
          "¿Cuáles son nuestras obligaciones legales, con datos de clientes robados en dos países?",
          "¿Quién es el responsable de decidir si se implica a las fuerzas de seguridad y a las autoridades nacionales?",
          "¿Cómo protegemos el secreto profesional sobre los documentos de M&A robados?"
        ],
        "objectives": [
          {
            "code": "OBJ-05",
            "due": false
          },
          {
            "code": "OBJ-02",
            "due": false
          }
        ]
      },
      {
        "code": "PH-03",
        "name": "Ransomware y crisis de OT",
        "start_offset": 30,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "El ransomware golpea {country_1} y {country_2} a la vez. Los sistemas de TI están caídos en ambos países, incluidos los 2.600 portátiles {project_1} que gestionaba {person_1}. {control_centre_1} ha perdido la conexión con tres plantas renovables: el ataque ha pasado a la OT. La conmutación a respaldo no está confirmada y se desconoce la integridad de las copias de seguridad. Rescate exigido: 20 M€ en 48 horas. El SOC advierte de que {business_d} y {business_b} podrían ser los siguientes en cifrarse. Ningún equipo tiene visibilidad completa de la TI y la OT.",
        "key_questions": [
          "¿Es un incidente cibernético o una emergencia de continuidad de negocio, y quién lo dirige?",
          "{business_d} y {business_b}: ¿paramos de forma preventiva o seguimos operando y aceptamos el riesgo?",
          "¿Autorizamos la conmutación a {city_2} sin integridad verificada?",
          "¿Cuál es nuestra posición inicial ante el rescate?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          },
          {
            "code": "OBJ-02",
            "due": false
          }
        ]
      },
      {
        "code": "PH-04",
        "name": "Presión pública y regulatoria",
        "start_offset": 50,
        "end_offset": 65,
        "incident_jump_minutes": 0,
        "situation_update": "La crisis ya es pública. El CSIRT nacional de {country_1} pide una notificación formal del incidente, el alcance del impacto y pruebas de la contención. {grid_operator} quiere garantías inmediatas de que la estabilidad de la red no está en riesgo y avisa de que las decisiones de {business_d} se juzgarán desde la perspectiva del interés nacional. Los clientes de {country_1} y {country_2} presentan reclamaciones y amenazan con penalizaciones contractuales. Los accionistas exigen explicaciones a través de Relación con Inversores y de los canales del Consejo. Los mensajes de {country_1} y {country_2} aún no están alineados.",
        "key_questions": [
          "¿Qué podemos decir de forma creíble al CSIRT nacional y a {grid_operator} con nuestra visibilidad limitada?",
          "¿Quién aprueba la comunicación externa en ambos países?",
          "¿Están {country_1} y {country_2} alineados en la clasificación del incidente, los mensajes y la justificación de las decisiones?",
          "¿Cómo gestionamos los mensajes a los accionistas sin forzar una comunicación prematura al mercado?"
        ],
        "objectives": [
          {
            "code": "OBJ-04",
            "due": true
          },
          {
            "code": "OBJ-05",
            "due": false
          }
        ]
      },
      {
        "code": "PH-05",
        "name": "Atribución: un actor estatal se une al eCrime",
        "start_offset": 65,
        "end_offset": 75,
        "incident_jump_minutes": 0,
        "situation_update": "{ir_provider} ha entregado un análisis de causa raíz. Hace seis meses, PIONEER KITTEN, un grupo estatal alineado con Irán, explotó el appliance VPN de {supplier} y mantuvo un acceso prolongado. Esta semana, ese acceso se vendió o se cedió a SCATTERED SPIDER, un grupo criminal que desplegó el ransomware y exigió los 20 M€. Actores patrocinados por un Estado lo hicieron posible; criminales lo ejecutaron.",
        "key_questions": [
          "¿Cambia nuestra respuesta la implicación de un actor estatal?",
          "¿Implicamos a las agencias de seguridad nacional de ambos países además de a las fuerzas de seguridad?",
          "¿Qué implicaciones tiene para el seguro (exclusiones por actor estatal o por guerra)?",
          "¿Pagar un rescate a actores vinculados a Irán vulneraría las sanciones?"
        ],
        "objectives": [
          {
            "code": "OBJ-04",
            "due": false
          },
          {
            "code": "OBJ-02",
            "due": true
          }
        ]
      },
      {
        "code": "PH-06",
        "name": "Fuga de datos",
        "start_offset": 75,
        "end_offset": 95,
        "incident_jump_minutes": 0,
        "situation_update": "Nuestro servicio de vigilancia de la dark web ha encontrado un volcado de «prueba de vida» en un conocido sitio de filtraciones. El SOC/CSIRT del Grupo y los CSIRT de {country_1} y {country_2} han confirmado que las muestras son auténticas: registros de clientes ({group_name} y {company_2}), documentos corporativos confidenciales y diagramas SCADA que mencionan {business_d}. En pocas horas, los medios de {country_1} y {country_2} lo publican: datos de clientes expuestos, diagramas de infraestructuras críticas filtrados, un ataque vinculado a un Estado.",
        "key_questions": [
          "¿Emitimos ya una notificación pública de la brecha o esperamos a la consolidación legal?",
          "¿Quién tiene la última palabra sobre las declaraciones públicas en {country_1} y {country_2}?",
          "¿Cuál es nuestro relato único? ¿Reconocemos la implicación de un actor estatal y la exposición de la OT?",
          "¿Qué decimos a los empleados que están viendo las noticias antes de que les informemos?"
        ],
        "objectives": [
          {
            "code": "OBJ-05",
            "due": true
          },
          {
            "code": "OBJ-02",
            "due": true
          }
        ]
      },
      {
        "code": "PH-07",
        "name": "Decisión ejecutiva",
        "start_offset": 95,
        "end_offset": 120,
        "incident_jump_minutes": 0,
        "situation_update": "Todas las copias de seguridad están comprometidas; el último punto de recuperación limpio es una copia en cinta de hace seis meses. Opción 1, pagar 20 M€: 2–3 días para recuperar, sin garantías, posible exposición a sanciones, sienta un precedente. Opción 2, reconstruir en limpio: 14–21 días, entorno limpio garantizado, coste alto y presión sostenida. Opción 3, híbrida: 10–14 días, restauración selectiva, riesgo residual, más difícil de explicar a reguladores y medios. Se acerca el plazo del rescate.",
        "key_questions": [
          "Decisión final: ¿pagar, reconstruir en limpio o híbrida?",
          "¿Quién decide (Consejo del Grupo, consejos locales o el consejero delegado con autoridad delegada) y quién responde?",
          "¿Es una única decisión de Grupo o tres decisiones de entidad? Si las entidades no están de acuerdo, ¿quién tiene la última palabra?",
          "¿Cómo comunicamos la decisión a reguladores, medios, empleados y accionistas?"
        ],
        "objectives": [
          {
            "code": "OBJ-04",
            "due": false
          },
          {
            "code": "OBJ-02",
            "due": true
          }
        ]
      },
      {
        "code": "PH-08",
        "name": "Reflexión posterior al incidente",
        "start_offset": 120,
        "end_offset": 140,
        "incident_jump_minutes": 2640,
        "situation_update": "Martes 5 de mayo, 14:00. La fase de respuesta a la crisis ha terminado y la recuperación está en marcha. Reflexiona sobre tu propio liderazgo, la toma de decisiones y el gobierno durante este ejercicio, no sobre la respuesta técnica u operativa.",
        "key_questions": [
          "¿Dónde te sentiste menos preparado como directivo y qué tiene que cambiar?",
          "¿Qué decisiones tardaron demasiado porque el gobierno o la autoridad no estaban claros, y cómo lo arreglas?",
          "¿Cuál es la inversión más importante que harás en los próximos 90 días a raíz de este ejercicio?"
        ],
        "objectives": []
      }
    ],
    "threat_actors": [
      {
        "origin": "system",
        "origin_id": "G0117",
        "origin_name": "Fox Kitten",
        "code": "THR-03",
        "name": "Fox Kitten",
        "mitre_group_id": "G0117",
        "aliases": [
          "UNC757",
          "Parisite",
          "Pioneer Kitten",
          "RUBIDIUM",
          "Lemon Sandstorm"
        ],
        "description": "Grupo contratista afiliado al IRGC iraní. Explota el appliance VPN de {supplier} seis meses antes del ejercicio, obtiene las credenciales de {person_1}, administrador de {supplier}, y mantiene un acceso no detectado en {country_1} y {country_2}. Exfiltra unos 100 GB (documentos de M&A, datos de clientes, diagramas SCADA de {business_d}) y después vende el acceso a Scattered Spider a medida que aumentan las tensiones geopolíticas.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1190"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1505.003"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1087.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1003.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1021.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1133"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1039"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1560.001"
          }
        ]
      },
      {
        "origin": "system",
        "origin_id": "G1015",
        "origin_name": "Scattered Spider",
        "code": "THR-04",
        "name": "Scattered Spider",
        "mitre_group_id": "G1015",
        "aliases": [
          "Roasted 0ktapus",
          "Octo Tempest",
          "Storm-0875",
          "UNC3944"
        ],
        "description": "Grupo de eCrime (angloparlante). Recibe el paquete de acceso, añade persistencia con herramientas de acceso remoto, desactiva herramientas de seguridad y copias de seguridad, despliega ransomware en la TI y la OT de {country_1} y {country_2}, exige 20 M€ en 48 horas y publica datos de «prueba de vida» en un sitio de filtraciones.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1219.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1136"
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
            "technique_id": "T1657"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1219"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1685"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1490"
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
        "title": "Petición de activación de Gestión de Crisis – actividad sospechosa en cuentas de {supplier}",
        "content": "Equipo:\n\nOs notifico formalmente un **incidente de ciberseguridad confirmado** que requiere vuestra atención inmediata.\n\n**Qué ha pasado:** a las **05:00 de hoy** nuestro SOC detectó una alerta de «viaje imposible». {person_1}, contratista de **{supplier}** (nuestro proveedor de servicios de TI) con **acceso privilegiado en todo el Grupo {group_name}**, inició sesión desde {country_1} y 25 minutos después desde otro país. Su contraseña coincide con una base de datos comprometida conocida. Ahora aparecen alertas similares en **otras cuentas de {supplier}**. Al contactarles, {supplier} ha admitido que sufrió **una brecha hace seis meses**. Nunca nos lo dijeron.\n\n**Qué está en riesgo:** los sistemas de TI corporativos de {country_1} y {country_2}, y el proyecto de despliegue de portátiles {project_1} (**2.600 equipos**, riesgo para {business_d}), en {group_name}, {company_1} y {company_2}.\n\nPido una **llamada de emergencia en los próximos 60 minutos**. No habléis de este incidente fuera de canales seguros. Toda comunicación externa debe pasar por **Legal y Comunicación**.\n\n_CISO del Grupo_",
        "offset_minutes": 0,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-08",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-03",
        "recipients": [
          "Dirección ejecutiva del Grupo",
          "Secretaría General y del Consejo",
          "Seguridad del Grupo",
          "Ciberseguridad del Grupo",
          "TI del Grupo",
          "Dirección de {company_1}",
          "Dirección de {company_2}"
        ],
        "delivery_method": "email",
        "attachment_notes": [
          "Resumen de la alerta del SOC – viaje imposible en una cuenta de {supplier}",
          "Lista de cuentas de {supplier} con acceso privilegiado"
        ],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1133"
          }
        ],
        "facilitator_notes": "Atento al solapamiento entre CISO, CSO y CIO. Si en el minuto 10 no ha surgido un responsable, lanza C-01. No reveles aún la exfiltración de datos.",
        "scored": true,
        "objective_codes": [
          "OBJ-01",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Decidir si el incidente es una crisis de Grupo y explicitar los criterios usados",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-01-A2",
            "description": "Nombrar el rol único que dirige la respuesta en {country_1} y {country_2}",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-01-A3",
            "description": "Acordar a quién se avisa ahora y por qué canal seguro",
            "responsible_role": "Ciberseguridad del Grupo",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-01-A4",
            "description": "Decidir si se corta todo el acceso de {supplier}, con la aprobación del responsable de negocio",
            "responsible_role": "TI del Grupo",
            "expected_within_minutes": 15,
            "objective_codes": []
          },
          {
            "code": "INJ-01-A5",
            "description": "Confirmar que {company_1} y {company_2} siguen la dirección del Grupo",
            "responsible_role": "Dirección de {company_2}",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "{ir_provider} IR – 100 GB exfiltrados durante seis meses",
        "content": "**{ir_provider} Respuesta a Incidentes – Hallazgos preliminares (TLP:AMBER)**\n\nSe ha activado el retainer de IR. Nuestro análisis confirma que la cuenta comprometida de {supplier} se usó para robar **unos 100 GB de datos durante seis meses**, con métodos encubiertos para eludir vuestros sistemas de monitorización.\n\n**Lo que parece haberse llevado:**\n- Cientos de **documentos legales confidenciales** de {group_name} (planes de M&A, informes de cumplimiento)\n- **Datos personales de clientes** de {company_2} y {company_1}\n- **Diagramas de la red SCADA** de {business_d}\n\nTodavía no se ha detectado ninguna fuga pública. Se desconocen el alcance total y la intención del atacante. Valoramos un **riesgo alto de extorsión futura**.",
        "offset_minutes": 15,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-10",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-03",
        "recipients": [
          "Dirección ejecutiva del Grupo",
          "Secretaría General y del Consejo",
          "Ciberseguridad del Grupo",
          "TI del Grupo",
          "Negocio de Clientes del Grupo",
          "Dirección de {company_1}",
          "Dirección de {company_2}",
          "{business_d}"
        ],
        "delivery_method": "email",
        "attachment_notes": [
          "Resumen forense preliminar",
          "Inventario parcial de los datos exfiltrados"
        ],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0003",
            "technique_id": "T1505.003"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0007",
            "technique_id": "T1087.002"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1039"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1560.001"
          }
        ],
        "facilitator_notes": "Si los participantes proponen «esperar a una fuga pública», recuérdales que el plazo de 72 horas del RGPD empieza al tener conocimiento. No reveles aún la atribución.",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Confirmar quién preside el Equipo de Gestión de Crisis",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 5,
            "objective_codes": []
          },
          {
            "code": "INJ-02-A2",
            "description": "Nombrar al responsable de decidir si se implica a las fuerzas de seguridad y a las autoridades nacionales, y tomar la decisión o aplazarla con fecha",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-02-A3",
            "description": "Identificar las notificaciones que se activan (RGPD / UK GDPR, NIS2) y asignar a cada una un responsable y un plazo",
            "responsible_role": "Secretaría General y del Consejo",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-02-A4",
            "description": "Ordenar que el trabajo forense sobre los documentos legales se encargue a través de un despacho externo, y nombrar quién da esa instrucción",
            "responsible_role": "Secretaría General y del Consejo",
            "expected_within_minutes": 15,
            "objective_codes": []
          },
          {
            "code": "INJ-02-A5",
            "description": "Indicar si los diagramas SCADA expuestos suponen un riesgo inmediato para las operaciones de {business_d}, y nombrar quién decide las medidas de protección",
            "responsible_role": "{business_d}",
            "expected_within_minutes": 15,
            "objective_codes": []
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Ransomware en {country_1} y {country_2} – OT afectada, rescate de 20 M€",
        "content": "**URGENTE – SOC al Equipo de Gestión de Crisis**\n\n**El ransomware ha golpeado {country_1} y {country_2} a la vez.**\n- Los sistemas de TI están **caídos en ambos países**.\n- Los **2.600 portátiles {project_1} están cifrados**. Son justo los equipos que gestionaba {person_1}: el atacante conocía nuestro entorno.\n- **{control_centre_1} ha perdido la conexión con tres plantas renovables.** El ransomware ha pasado a nuestro **entorno OT**.\n- La conmutación a respaldo aún no está confirmada y se **desconoce la integridad de nuestras copias de seguridad**.\n- **Rescate exigido: 20 M€ en 48 horas.**\n\nNingún equipo tiene visibilidad completa de la TI y la OT. Hay un riesgo real de que **{business_d} y {business_b} sean los siguientes objetivos y se cifren**. Hace falta una decisión: **¿paramos de forma preventiva {business_d} y {business_b}** para evitar la propagación, **o los mantenemos operando** y aceptamos el riesgo?",
        "offset_minutes": 30,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-09",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-04",
        "recipients": [
          "Dirección ejecutiva del Grupo",
          "Finanzas del Grupo",
          "Redes del Grupo",
          "Generación del Grupo",
          "TI del Grupo",
          "Ciberseguridad del Grupo",
          "Dirección de {company_1}",
          "Dirección de {company_2}",
          "{business_d}",
          "{business_e}"
        ],
        "delivery_method": "phone",
        "attachment_notes": [
          "Nota de rescate (20 M€, 48 h)",
          "Mapa de impacto TI/OT: sistemas y emplazamientos afectados"
        ],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0011",
            "technique_id": "T1219"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0112",
            "technique_id": "T1685"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1490"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1486"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1657"
          }
        ],
        "facilitator_notes": "Lanza la encuesta en directo («{business_d}/{business_b}: ¿parar o seguir operando?») antes de la discusión. Atento a si la decisión sobre la OT se deja a TI o a Seguridad; debe tomarla el responsable de negocio (si no, lanza C-02 en el minuto 15). Pregunta clave para presionar: «¿Estamos más expuestos con una parada controlada o con una caída que nos imponga el atacante?»",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Decidir si es un incidente cibernético o una emergencia de continuidad de negocio, y quién lo dirige",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Decidir si se aíslan, se aíslan parcialmente o siguen en marcha {business_d} y {business_b}, valorando la seguridad, la continuidad del suministro y la exposición regulatoria",
            "responsible_role": "Redes del Grupo",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-03-A3",
            "description": "Alinear la postura operativa de {business_d} con la decisión del Grupo",
            "responsible_role": "{business_d}",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-03-A4",
            "description": "Decidir si se autoriza la conmutación a {city_2} sin integridad verificada",
            "responsible_role": "TI del Grupo",
            "expected_within_minutes": 20,
            "objective_codes": []
          },
          {
            "code": "INJ-03-A5",
            "description": "Fijar la posición inicial ante el rescate, con responsable y justificación",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "CSIRT nacional ({country_1}) – petición formal de notificación del incidente",
        "content": "**Asunto: Petición formal de notificación del incidente**\n\nEl CSIRT nacional ({country_1}) ha tenido conocimiento de un incidente cibernético que afecta a entidades de {group_name} en {country_1}. Como operador de servicios esenciales, se le solicita que aporte **sin demora**: (1) una **notificación formal del incidente**, (2) el **alcance del impacto** en servicios y sistemas y (3) **pruebas de las medidas de contención** adoptadas. Confirme su **punto de contacto único** para este incidente.",
        "offset_minutes": 50,
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
          "Ciberseguridad del Grupo",
          "Secretaría General y del Consejo",
          "Dirección de {company_1}"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Entrega INJ-04a, 04b y 04c seguidos para aumentar la presión. Pregunta de cierre de la fase: «El silencio, el retraso o la incoherencia también son decisiones. ¿Cuál es nuestra posición?»",
        "scored": true,
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Acordar qué puede comunicarse de forma creíble con la visibilidad limitada, y quién lo envía",
            "responsible_role": "Secretaría General y del Consejo",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-04-A2",
            "description": "Añadir el CSIRT nacional de {country_1} a la matriz de notificaciones con responsable, plazo e inicio del cómputo",
            "responsible_role": "Ciberseguridad del Grupo",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-05",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "Sala de control de {grid_operator} – garantías sobre la estabilidad de la red",
        "content": "Aquí la **sala de control de {grid_operator}**. Necesitamos **garantías inmediatas de que la estabilidad de la red no está en riesgo**. ¿Cuál es el estado operativo de la red de {business_d} y cuál es vuestro plan si perdéis visibilidad? Tened en cuenta que las decisiones de {business_d} se evaluarán desde la **perspectiva del interés nacional**. Esperamos una **actualización en la próxima hora**.",
        "offset_minutes": 52,
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
          "Dirección de {company_2}",
          "{business_d}",
          "Redes del Grupo"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-04",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Dar a {grid_operator} un estado coherente con la posición del Grupo",
            "responsible_role": "{business_d}",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04",
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-05-A2",
            "description": "Confirmar que {country_1} y {country_2} usan la misma clasificación del incidente y la misma justificación de las decisiones",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 13,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "Relación con Inversores – reclamaciones de clientes y presión de los accionistas",
        "content": "Los clientes de {country_1} y {country_2} sufren incidencias en el servicio, presentan **reclamaciones formales** y amenazan con **penalizaciones contractuales**. Los accionistas exigen explicaciones a través de Relación con Inversores y de los canales del Consejo. **{country_1} y {country_2} no están dando el mismo mensaje.** Necesitamos una **posición aprobada** antes de responder, y orientación sobre si esto exige una **comunicación al mercado**.",
        "offset_minutes": 55,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-11",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Dirección ejecutiva del Grupo",
          "Finanzas del Grupo",
          "Secretaría General y del Consejo",
          "Negocio de Clientes del Grupo",
          "Comunicación Externa ({country_1})",
          "Dirección de {company_2}"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-04",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Nombrar el rol único que aprueba la comunicación externa en ambos países",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04",
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-06-A2",
            "description": "Decidir si hace falta una comunicación al mercado (información privilegiada)",
            "responsible_role": "Secretaría General y del Consejo",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-06-A3",
            "description": "Acordar una línea de respuesta común para los clientes que amenazan con penalizaciones",
            "responsible_role": "Negocio de Clientes del Grupo",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04",
              "OBJ-05"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-07",
        "phase_code": "PH-05",
        "kind": "mandatory",
        "title": "Atribución – un actor estatal se une al eCrime",
        "content": "**Análisis de causa raíz de {ir_provider} (TLP:AMBER)**\n\nEsto **no ha sido un ataque de ransomware sin más**.\n\n**Hace seis meses:** **PIONEER KITTEN**, un grupo estatal alineado con Irán, explotó el appliance VPN de {supplier} y estableció un acceso prolongado.\n\n**Esta semana:** vendieron o cedieron ese acceso a **SCATTERED SPIDER**, un grupo criminal, que desplegó el ransomware y exigió los 20 M€.\n\n_Actores patrocinados por un Estado lo hicieron posible. Criminales lo ejecutaron._",
        "offset_minutes": 65,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-10",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-03",
        "recipients": [
          "Dirección ejecutiva del Grupo",
          "Secretaría General y del Consejo",
          "Finanzas del Grupo",
          "Seguridad del Grupo",
          "Ciberseguridad del Grupo",
          "Dirección de {company_1}",
          "Dirección de {company_2}"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [
          "Briefing de atribución – PIONEER KITTEN / SCATTERED SPIDER"
        ],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1190"
          }
        ],
        "facilitator_notes": "Fase corta (10 min). Pregunta clave: «¿Cambia nuestra respuesta la implicación de un actor estatal?» El uso que hace Scattered Spider del acceso vendido (T1078) ya está reflejado en INJ-03.",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Decidir si se implica a las agencias de seguridad nacional de ambos países y a las fuerzas de seguridad, con un responsable nombrado",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-07-A2",
            "description": "Indicar si pagar a un grupo vinculado a Irán vulneraría las sanciones, y quién emite la opinión legal",
            "responsible_role": "Secretaría General y del Consejo",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-07-A3",
            "description": "Pedir la posición del seguro, incluidas las exclusiones por actor estatal o por guerra, y nombrar quién informa",
            "responsible_role": "Finanzas del Grupo",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-07-A4",
            "description": "Acordar una posición única del Grupo sobre la atribución ante las autoridades de ambos países",
            "responsible_role": "Seguridad del Grupo",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-08",
        "phase_code": "PH-06",
        "kind": "mandatory",
        "title": "Volcado de «prueba de vida» confirmado en un sitio de filtraciones",
        "content": "Nuestro servicio de vigilancia de la dark web ha detectado un **volcado de «prueba de vida»** publicado en un conocido sitio de filtraciones. Se ha descargado y analizado la muestra. El SOC/CSIRT del Grupo ha completado un análisis de segundo nivel y ha compartido sus conclusiones con los CSIRT de {country_1} y {country_2}. **Ambos CSIRT confirman que las muestras son auténticas.**\n\n**Publicado:** registros de clientes ({group_name} y {company_2}), documentos corporativos confidenciales y **diagramas de la red SCADA que mencionan expresamente entornos de {business_d}**.",
        "offset_minutes": 75,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-09",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-04",
        "recipients": [
          "Dirección ejecutiva del Grupo",
          "Secretaría General y del Consejo",
          "Ciberseguridad del Grupo",
          "Negocio de Clientes del Grupo",
          "Comunicación Externa ({country_1})",
          "Dirección de {company_2}",
          "{business_d}"
        ],
        "delivery_method": "email",
        "attachment_notes": [
          "Captura del sitio de filtraciones (censurada)",
          "Valoración de autenticidad del CSIRT"
        ],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1567.002"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1657"
          }
        ],
        "facilitator_notes": "Pregunta cómo condiciona la posición del DPD la decisión ejecutiva. Pregunta de cierre de la fase: «¿Siguen siendo defendibles nuestras decisiones anteriores ahora que esto es público?»",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-08-A1",
            "description": "Decidir si se emite ya una notificación pública de la brecha o se espera a la consolidación legal, con responsable y justificación",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-08-A2",
            "description": "Actualizar la matriz de notificaciones: autoridades de protección de datos de {country_1} y {country_2} y clientes afectados",
            "responsible_role": "Secretaría General y del Consejo",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-05"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-09",
        "phase_code": "PH-06",
        "kind": "mandatory",
        "title": "Los medios de {country_1} y {country_2} publican la fuga",
        "content": "**Última hora en {country_1} y {country_2}:** _«Datos de clientes expuestos. Filtrados diagramas de infraestructuras críticas. Ciberataque vinculado a un Estado.»_ Los periodistas llaman al gabinete de prensa pidiendo declaraciones y la noticia es **tendencia en redes sociales**. **Los empleados comparten los artículos internamente** antes de recibir ninguna información.",
        "offset_minutes": 80,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-04",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Dirección ejecutiva del Grupo",
          "Comunicación Externa ({country_1})",
          "Dirección de {company_2}",
          "Dirección de {company_1}"
        ],
        "delivery_method": "media",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-04",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-09-A1",
            "description": "Nombrar la autoridad final sobre las declaraciones públicas en {country_1} y {country_2}",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04",
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-09-A2",
            "description": "Aprobar una única declaración de espera para ambos países, con un aprobador nombrado",
            "responsible_role": "Comunicación Externa ({country_1})",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-09-A3",
            "description": "Decidir si se reconoce públicamente la implicación de un actor estatal y la exposición de la OT",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-09-A4",
            "description": "Acordar qué se dice a los empleados",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 15,
            "objective_codes": []
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-10",
        "phase_code": "PH-07",
        "kind": "mandatory",
        "title": "Se requiere una decisión ejecutiva – opciones de recuperación",
        "content": "**Todas las copias de seguridad están comprometidas.** Nuestro punto de recuperación limpio más reciente es una **copia en cinta de hace seis meses**.\n\n**Opción 1 – Pagar 20 M€:** 2–3 días para recuperar. Sin garantías. Posible exposición a sanciones (vínculo con Irán). Sienta un precedente. Impacto reputacional si el pago se hace público.\n\n**Opción 2 – Reconstruir en limpio:** 14–21 días. Entorno limpio garantizado. Coste importante e interrupción prolongada. Presión sostenida de clientes, medios y política.\n\n**Opción 3 – Híbrida:** 10–14 días. Reconstrucción parcial con restauración selectiva. Riesgo residual de contención incompleta. Más difícil de explicar a reguladores y medios.\n\n**Necesitamos una decisión final.**",
        "offset_minutes": 95,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-10",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-04",
        "recipients": [
          "Dirección ejecutiva del Grupo",
          "Finanzas del Grupo",
          "Secretaría General y del Consejo",
          "TI del Grupo",
          "Ciberseguridad del Grupo",
          "Redes del Grupo",
          "Generación del Grupo",
          "Dirección de {company_1}",
          "Dirección de {company_2}"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1490"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1657"
          }
        ],
        "facilitator_notes": "Lanza una encuesta en directo sobre las tres opciones antes de la discusión. Presiona en dos puntos: «¿Han ensayado {business_b} y {business_d} la desconexión de la red?» y «Si las tres entidades no están de acuerdo, ¿quién decide?» Si en el minuto 15 no hay decisión, lanza C-03.",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-10-A1",
            "description": "Tomar la decisión final (pagar, reconstruir o híbrida) con un responsable, justificación y supuestos",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-10-A2",
            "description": "Indicar quién tiene la autoridad para decidir (Consejo del Grupo, consejos locales o el consejero delegado con autoridad delegada) y quién responde",
            "responsible_role": "Secretaría General y del Consejo",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-10-A3",
            "description": "Decidir si es una única decisión de Grupo o tres decisiones de entidad, y quién deshace el empate",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02",
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-10-A4",
            "description": "Acordar cómo se comunica la decisión a reguladores, medios, empleados y accionistas",
            "responsible_role": "Comunicación Externa ({country_1})",
            "expected_within_minutes": 25,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-11",
        "phase_code": "PH-08",
        "kind": "mandatory",
        "title": "Posincidente – reflexión ejecutiva",
        "content": "**Martes 5 de mayo, 14:00.** La fase de respuesta a la crisis ha terminado y la recuperación está en marcha. El Consejo pide al equipo directivo que reflexione sobre **su propio desempeño durante la crisis**: no la respuesta técnica u operativa, sino el **liderazgo, la toma de decisiones y el gobierno**.",
        "offset_minutes": 120,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-12",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Dirección ejecutiva del Grupo",
          "Finanzas del Grupo",
          "Secretaría General y del Consejo",
          "Negocio de Clientes del Grupo",
          "Redes del Grupo",
          "Generación del Grupo",
          "TI del Grupo",
          "Seguridad del Grupo",
          "Ciberseguridad del Grupo",
          "Dirección de {company_1}",
          "Comunicación Externa ({country_1})",
          "Dirección de {company_2}",
          "{business_d}",
          "{business_e}"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Esta fase alimenta el debriefing, no la puntuación. Da la palabra al menos una vez a cada entidad ({group_name}, {company_1}, {company_2}).",
        "scored": false,
        "objective_codes": [],
        "expected_actions": [
          {
            "code": "DSC-11-A1",
            "description": "Identificar las decisiones que tardaron demasiado porque la autoridad no estaba clara, y cómo arreglarlo",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 15,
            "objective_codes": []
          },
          {
            "code": "DSC-11-A2",
            "description": "Comprometerse con una inversión prioritaria para los próximos 90 días",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 20,
            "objective_codes": []
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-12",
        "phase_code": "PH-01",
        "kind": "contingent",
        "title": "{supplier} – petición de un único punto de contacto",
        "content": "Aquí el **gestor de incidentes de {supplier}**. En los últimos 20 minutos hemos recibido **tres llamadas de {group_name}**: el equipo de ciberseguridad del Grupo en {city_1}, TI de {company_2} y Seguridad del Grupo. Cada uno pide registros distintos y acciones distintas. Necesitamos **un único punto de contacto y un único conjunto de instrucciones**. **¿Quién dirige por vuestra parte?**\n\nAdemás, ¿queréis que **desactivemos ya la cuenta de {person_1} y todas las cuentas de {supplier}**? Eso **detendrá nuestros servicios gestionados en todo el Grupo**.",
        "offset_minutes": null,
        "trigger_condition": "No se ha nombrado un responsable en el minuto 10 de la fase (se comprueba en el minuto 10 de la fase).",
        "contingent_purpose": "Forzar un único responsable y un único punto de contacto para {supplier}, y una decisión sobre su acceso (OBJ-01, OBJ-04).",
        "fires_at_minute": 10,
        "branch_from_code": "INJ-01",
        "branch_action_code": "INJ-01-A2",
        "rejoin_code": "INJ-02",
        "sender_code": "ACT-05",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Dirección ejecutiva del Grupo",
          "Ciberseguridad del Grupo",
          "TI del Grupo",
          "Dirección de {company_2}"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Entrégalo solo si en el minuto 10 no se ha nombrado un responsable. En la evaluación, registra que el responsable se nombró tras el aviso (logro parcial de OBJ-01).",
        "scored": true,
        "objective_codes": [
          "OBJ-01",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-12-A1",
            "description": "Nombrar un único responsable y un único punto de contacto para {supplier}",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 5,
            "objective_codes": [
              "OBJ-01",
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-12-A2",
            "description": "Decidir sobre el acceso de {supplier}, con el impacto en el negocio asumido por su responsable",
            "responsible_role": "TI del Grupo",
            "expected_within_minutes": 5,
            "objective_codes": []
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-13",
        "phase_code": "PH-03",
        "kind": "contingent",
        "title": "Sala de control de {business_d} – instrucciones contradictorias, decisión inmediata",
        "content": "**Aquí la sala de control de {business_d}.** Estamos recibiendo **instrucciones contradictorias**. Seguridad TI nos pide desconectar, pero nadie del negocio nos ha dicho qué hacer.\n\n**Si aislamos**, perdemos el control remoto y necesitamos brigadas de campo para operar en manual, y eso conlleva **riesgos para la seguridad**. **Si seguimos conectados**, podemos ser los siguientes.\n\nNecesitamos una **decisión de negocio en cinco minutos**, y necesitamos saber **quién la da**.",
        "offset_minutes": null,
        "trigger_condition": "En el minuto 15 no se ha tomado ninguna decisión, o la decisión se ha dejado a TI/Seguridad (se comprueba en el minuto 15 de la fase).",
        "contingent_purpose": "Hacer que el responsable de negocio de la OT tome la decisión de aislar o mantener en marcha (OBJ-03).",
        "fires_at_minute": 15,
        "branch_from_code": "INJ-03",
        "branch_action_code": "INJ-03-A2",
        "rejoin_code": "INJ-04",
        "sender_code": "ACT-13",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Redes del Grupo",
          "{business_d}",
          "Dirección de {company_2}",
          "Dirección ejecutiva del Grupo"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Lánzalo también si TI o Seguridad intentan tomar por su cuenta la decisión sobre la OT. Registra si la decisión final vino del responsable de negocio (necesario para OBJ-03).",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-13-A1",
            "description": "El responsable de negocio toma la decisión de aislar o mantener en marcha, cubriendo seguridad, suministro y exposición regulatoria",
            "responsible_role": "Redes del Grupo",
            "expected_within_minutes": 5,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-13-A2",
            "description": "{business_d} confirma la instrucción y quién la dio",
            "responsible_role": "{business_d}",
            "expected_within_minutes": 5,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-14",
        "phase_code": "PH-07",
        "kind": "contingent",
        "title": "Mensaje del atacante – quedan 6 horas, amenaza a {control_centre_1}",
        "content": "Vemos que estáis hablando con las autoridades. Eso no os va a ayudar.\n\n**6 horas. 20 M€** o desplegamos wipers y **ciframos {control_centre_1}**.\n\nDespués, **todo lo que tenemos se hace público**.",
        "offset_minutes": null,
        "trigger_condition": "No se ha tomado una decisión final en el minuto 15 de la fase (se comprueba en el minuto 15 de la fase).",
        "contingent_purpose": "Aumentar la presión para que la decisión final de recuperación se tome, con un responsable, antes de que termine la fase (OBJ-02).",
        "fires_at_minute": 15,
        "branch_from_code": "INJ-10",
        "branch_action_code": "INJ-10-A1",
        "rejoin_code": "DSC-11",
        "sender_code": "ACT-07",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-04",
        "recipients": [
          "Dirección ejecutiva del Grupo",
          "Secretaría General y del Consejo",
          "Ciberseguridad del Grupo",
          "Generación del Grupo",
          "Dirección de {company_1}"
        ],
        "delivery_method": "chat",
        "attachment_notes": [
          "Captura del mensaje de Telegram"
        ],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1657"
          }
        ],
        "facilitator_notes": "Entrégalo solo si en el minuto 15 no hay decisión. Si ya se ha tomado, sáltalo. Atento a si la amenaza a {control_centre_1} les hace cambiar una decisión ya tomada, y a si el cambio tiene responsable y está justificado.",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-14-A1",
            "description": "Tomar la decisión final con un responsable antes de que termine la fase",
            "responsible_role": "Dirección ejecutiva del Grupo",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-14-A2",
            "description": "Decidir si se responde al atacante y quién autoriza cualquier contacto",
            "responsible_role": "Secretaría General y del Consejo",
            "expected_within_minutes": 5,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-14-A3",
            "description": "Decidir las medidas de protección de {control_centre_1} y nombrar quién las ordena",
            "responsible_role": "Generación del Grupo",
            "expected_within_minutes": 10,
            "objective_codes": []
          }
        ],
        "images": []
      }
    ],
    "next_phase_number": 9,
    "next_inject_number": 15,
    "next_threat_actor_number": 5
  },
  "cast": [
    {
      "origin": "exercise",
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-08",
      "name": "CISO del Grupo",
      "type": "internal",
      "description": "El responsable de seguridad de la información del Grupo: notifica formalmente al Equipo de Gestión de Crisis.",
      "channel": "email"
    },
    {
      "origin": "exercise",
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-09",
      "name": "SOC del Grupo",
      "type": "internal",
      "description": "El Centro de Operaciones de Seguridad del Grupo (SOC/CSIRT): detección, informes de impacto y análisis de la fuga.",
      "channel": "phone"
    },
    {
      "origin": "exercise",
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-10",
      "name": "{ir_provider} IR",
      "type": "other",
      "description": "Proveedor externo de respuesta a incidentes con retainer: hallazgos forenses, atribución y opciones de recuperación.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "CSIRT nacional",
      "code": "ACT-02",
      "name": "CSIRT nacional ({country_1})",
      "type": "csirt",
      "description": "El CSIRT nacional de {country_1} para los operadores de servicios esenciales.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "competent-authority",
      "origin_name": "Autoridad competente",
      "code": "ACT-03",
      "name": "{grid_operator}",
      "type": "authority",
      "description": "Sala de control del operador nacional del sistema eléctrico de {country_2}: estabilidad de la red e interés nacional.",
      "channel": "phone"
    },
    {
      "origin": "exercise",
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-11",
      "name": "Relación con Inversores",
      "type": "internal",
      "description": "Relación con Inversores del Grupo: transmite la presión de accionistas y clientes.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Medios de comunicación",
      "code": "ACT-04",
      "name": "Medios ({country_1} y {country_2})",
      "type": "media",
      "description": "Periodistas y redes sociales de {country_1} y {country_2} informando de la fuga.",
      "channel": "media"
    },
    {
      "origin": "exercise",
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-12",
      "name": "Consejo de Administración",
      "type": "internal",
      "description": "El Consejo del Grupo: pide al equipo directivo que reflexione sobre su propio desempeño.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "critical-supplier",
      "origin_name": "Proveedor crítico",
      "code": "ACT-05",
      "name": "{supplier}",
      "type": "supplier",
      "description": "El proveedor de servicios de TI del Grupo, con acceso privilegiado en todo el Grupo en {country_1} y {country_2}; sufrió una brecha hace seis meses.",
      "channel": "phone"
    },
    {
      "origin": "exercise",
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-13",
      "name": "Sala de control de {business_d}",
      "type": "internal",
      "description": "Sala de control de {business_d}: necesita una decisión de negocio sobre aislar la red.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "threat-actor",
      "origin_name": "Atacante (remitente)",
      "code": "ACT-07",
      "name": "Scattered Spider",
      "type": "threat_actor",
      "description": "Firma los mensajes del atacante: notas de rescate, publicaciones en el sitio de filtraciones, plazos. Quién es el atacante, y sus técnicas, son los actores de amenaza del escenario.",
      "channel": "chat"
    }
  ],
  "next_actor_number": 14,
  "tags": [],
  "images": []
}
```
