"""Páginas de búsqueda para Google: /venta/<slug> (p. ej. /venta/paso-de-misterio).

Igual que hace Milanuncios, cada página responde a una búsqueda concreta
("venta paso de misterio", "túnica de nazareno segunda mano"...). Muestra un
texto propio, los anuncios que coinciden con esas palabras y, si hay pocos,
otros anuncios relacionados para que la página nunca quede vacía.

Para añadir una búsqueda nueva basta con añadir un elemento a LANDINGS.
  - slug:        dirección (/venta/<slug>), en minúsculas y con guiones.
  - name:        cómo se llama la cosa, en plural si procede (va en el H1).
  - keywords:    palabras que buscamos en título y descripción de los anuncios
                 (sin importar tildes ni mayúsculas; también encuentra plurales).
  - category:    slug de la categoría de la web para rellenar con relacionados.
  - intro:       2 párrafos propios. Es lo que Google lee para entender la página:
                 que no se repita entre páginas.
  - related:     otras búsquedas a las que enlazar.
  - must:        (opcional) grupos de palabras que TODOS deben aparecer, p. ej.
                 [["virgen", "dolorosa"], ["xviii", "siglo 18"]] = una Virgen Y del siglo XVIII.
  - parent:      (opcional) búsqueda general de la que cuelga. Estas búsquedas concretas
                 solo se ofrecen a Google cuando tienen al menos un anuncio.
"""

import re
import unicodedata
from typing import Optional

LANDINGS: list[dict] = [
    # ---------------- Categorías principales ----------------
    {
        "slug": "tunicas-de-nazareno",
        "name": "Túnicas de nazareno",
        "keywords": ["tunica", "nazareno", "antifaz", "tunica de nazareno", "habito"],
        "category": "tunicas-capirotes",
        "intro": [
            "Encuentra túnicas de nazareno de segunda mano y nuevas publicadas por cofrades de toda España. "
            "Hay túnicas de cola, de sarga, de ruan o de terciopelo, con su antifaz y a veces con capa, "
            "de tallas infantiles y de adulto.",
            "Antes de comprar, comprueba que el color y el tejido son los que marcan las reglas de tu "
            "hermandad y pide al vendedor las medidas de largo y de hombros. Si ya no vas a usar la tuya, "
            "publicarla en VentaCofrade es gratis.",
        ],
        "related": ["capirotes", "cingulos-y-complementos-de-nazareno", "dalmaticas-y-ropa-de-acolito", "medallas-de-hermandad"],
    },
    {
        "slug": "capirotes",
        "name": "Capirotes",
        "keywords": ["capirote", "capirotes", "carton de capirote", "cucurucho"],
        "category": "tunicas-capirotes",
        "intro": [
            "Capirotes de cartón y de rejilla en venta, de distintas alturas y medidas de cabeza. "
            "Muchos cofrades venden el suyo cuando cambian de talla o de hermandad, y otros los "
            "fabrican a medida.",
            "Fíjate en la altura total y en el contorno de la base, y pregunta si incluye el antifaz. "
            "Un capirote bien ajustado marca la diferencia en una estación de penitencia larga.",
        ],
        "related": ["tunicas-de-nazareno", "cingulos-y-complementos-de-nazareno", "medallas-de-hermandad"],
    },
    {
        "slug": "orfebreria-cofrade",
        "name": "Orfebrería cofrade",
        "keywords": ["orfebreria", "plata", "plateria", "metal plateado", "alpaca", "baño de plata"],
        "category": "orfebreria",
        "intro": [
            "Orfebrería religiosa y cofrade en venta: piezas en plata de ley, metal plateado o dorado y "
            "alpaca, desde candelabros y jarras hasta ciriales, varales, coronas y piezas de altar.",
            "En orfebrería conviene preguntar por el material, el taller o la firma, el estado de la pieza "
            "y si hace falta restaurarla. Pide fotos de los punzones o contrastes si el vendedor dice que es plata.",
        ],
        "related": ["candelabros-y-candeleros", "coronas-y-potencias", "ciriales-y-cruz-de-guia", "incensarios-y-navetas"],
    },
    {
        "slug": "bordados-cofrades",
        "name": "Bordados cofrades",
        "keywords": ["bordado", "bordada", "bordados en oro", "oro fino", "sedas", "hilo de oro"],
        "category": "bordados",
        "intro": [
            "Bordados en oro y sedas para hermandades y cofradías: mantos, sayas, bambalinas, estandartes, "
            "faldones y piezas sueltas para pasar a nuevo soporte.",
            "En los bordados importa mucho el estado del tejido de fondo y del hilo. Pregunta si el bordado "
            "es a mano o a máquina, sus medidas y si ha sido restaurado alguna vez.",
        ],
        "related": ["mantos-y-sayas", "estandartes-y-simpecados", "paso-de-palio"],
    },
    {
        "slug": "cirios-y-cera",
        "name": "Cirios y cera",
        "keywords": ["cirio", "cera", "vela", "candeleria", "velon", "cirio pascual"],
        "category": "cirios-velas",
        "intro": [
            "Cirios de nazareno, velas rizadas y lisas, candelería para palio y cera para cultos. "
            "Encuentra lotes de cera a buen precio y piezas de diferentes grosores y alturas.",
            "Comprueba el diámetro y la altura, si la cera es de color o blanca y si los cirios están "
            "rizados. La cera se conserva bien si se guarda en un lugar fresco y sin luz directa.",
        ],
        "related": ["paso-de-palio", "candelabros-y-candeleros", "tunicas-de-nazareno"],
    },
    {
        "slug": "imagenes-religiosas",
        "name": "Imágenes religiosas",
        "keywords": ["imagen", "talla", "escultura", "virgen", "cristo", "dolorosa", "niño jesus", "santo"],
        "category": "imagenes-figuras",
        "intro": [
            "Imágenes religiosas en venta: tallas en madera, imágenes de vestir, dolorosas, crucificados, "
            "Niños Jesús e imaginería para particulares, capillas y hermandades.",
            "En imaginería pregunta por el autor o el taller, el material, la altura y si la pieza tiene "
            "repintes o daños. Para imágenes de culto, conviene pedir fotos con buena luz de rostro y manos.",
        ],
        "related": ["crucifijos", "imagenes-de-la-virgen", "miniaturas-cofrades", "belenes-y-nacimientos"],
    },
    {
        "slug": "medallas-de-hermandad",
        "name": "Medallas de hermandad",
        "keywords": ["medalla", "insignia", "cordon", "escapulario", "distintivo", "pin"],
        "category": "insignias-medallas",
        "intro": [
            "Medallas de hermandad con su cordón, insignias, escapularios y distintivos de cofradías. "
            "Una forma sencilla de completar tu colección o de conseguir la medalla que te falta.",
            "Pregunta de qué hermandad es, si es de plata o de metal y si el cordón es el original. "
            "Muchas medallas antiguas tienen valor para coleccionistas.",
        ],
        "related": ["tunicas-de-nazareno", "rosarios", "antiguedades-religiosas"],
    },
    {
        "slug": "instrumentos-de-banda-cofrade",
        "name": "Instrumentos de banda cofrade",
        "keywords": ["corneta", "tambor", "trompeta", "bombardino", "tuba", "caja", "timbal", "banda", "cornetas y tambores", "trombon"],
        "category": "instrumentos-musicales",
        "intro": [
            "Instrumentos para bandas de cornetas y tambores, agrupaciones musicales y bandas de música: "
            "cornetas, trompetas, bombardinos, tubas, cajas, tambores y timbales.",
            "Pregunta por la marca, el estado de pistones y parches, y si incluye estuche. Para bandas "
            "que empiezan, comprar instrumentos de segunda mano ahorra mucho dinero.",
        ],
        "related": ["uniformes-de-banda", "libros-y-carteles-cofrades"],
    },
    {
        "slug": "pasos-procesionales",
        "name": "Pasos procesionales",
        "keywords": ["paso", "trono", "andas", "parihuela", "canastilla", "respiradero", "maniguetas", "paso procesional"],
        "category": "pasos",
        "intro": [
            "Pasos procesionales y tronos en venta: canastillas, parihuelas, andas, respiraderos, "
            "maniguetas y elementos completos o por piezas para hermandades y grupos parroquiales.",
            "En un paso son clave las medidas, el número de costaleros o portadores que necesita y el "
            "estado de la madera y del dorado. Pregunta también cómo se desmonta y cómo se transporta.",
        ],
        "related": ["paso-de-misterio", "paso-de-palio", "costales-y-ropa-de-costalero", "candelabros-y-candeleros"],
    },
    # ---------------- Búsquedas concretas ----------------
    {
        "slug": "paso-de-misterio",
        "name": "Pasos de misterio",
        "keywords": ["paso de misterio", "misterio", "canastilla", "paso de cristo", "trono", "andas", "paso"],
        "category": "pasos",
        "intro": [
            "Pasos de misterio y de Cristo en venta, completos o por partes: canastillas talladas, "
            "parihuelas, respiraderos, faroles y candelabros de guardabrisas, y los elementos que "
            "acompañan a las imágenes secundarias del misterio.",
            "Si buscas un paso para una hermandad nueva o para una salida infantil, revisa las medidas "
            "de la mesa, la altura total y el peso. Los vendedores suelen aceptar visitas para verlo "
            "en persona antes de cerrar el trato.",
        ],
        "related": ["pasos-procesionales", "paso-de-palio", "miniaturas-cofrades", "costales-y-ropa-de-costalero"],
    },
    {
        "slug": "paso-de-palio",
        "name": "Pasos de palio",
        "keywords": ["palio", "paso de palio", "varal", "bambalina", "techo de palio", "candeleria", "peana", "jarras"],
        "category": "pasos",
        "intro": [
            "Todo para el paso de palio: varales, bambalinas, techos de palio, candelería, jarras, "
            "peanas, respiraderos y piezas de orfebrería para la Virgen.",
            "Al comprar piezas de palio conviene indicar las medidas de tu paso para que encajen: "
            "número y altura de los varales, largo de las bambalinas y número de tandas de candelería.",
        ],
        "related": ["pasos-procesionales", "mantos-y-sayas", "coronas-y-potencias", "cirios-y-cera"],
    },
    {
        "slug": "mantos-y-sayas",
        "name": "Mantos y sayas",
        "keywords": ["manto", "saya", "tocado", "rostrillo", "toca", "manto de salida", "ajuar"],
        "category": "bordados",
        "intro": [
            "Mantos de salida y de camarín, sayas, tocas, rostrillos y ajuar para imágenes de la Virgen. "
            "Piezas bordadas, lisas y de terciopelo para vestir a la Dolorosa durante todo el año.",
            "Indica la altura de la imagen y pide las medidas exactas del manto o de la saya. En piezas "
            "antiguas pregunta por el estado del terciopelo y si el bordado se puede pasar a nuevo soporte.",
        ],
        "related": ["bordados-cofrades", "coronas-y-potencias", "imagenes-de-la-virgen"],
    },
    {
        "slug": "coronas-y-potencias",
        "name": "Coronas y potencias",
        "keywords": ["corona", "diadema", "rafaga", "aureola", "potencias", "puñal", "media luna", "nimbo"],
        "category": "orfebreria",
        "intro": [
            "Coronas para la Virgen, diademas, ráfagas, potencias para el Señor, nimbos, puñales y "
            "medias lunas en plata, metal dorado o plateado.",
            "La medida más importante es el diámetro del aro o la sujeción que lleva la imagen. "
            "Pide fotos del reverso para ver cómo se fija y si tiene punzones del orfebre.",
        ],
        "related": ["orfebreria-cofrade", "mantos-y-sayas", "imagenes-de-la-virgen"],
    },
    {
        "slug": "ciriales-y-cruz-de-guia",
        "name": "Ciriales y cruces de guía",
        "keywords": ["cirial", "cruz de guia", "cruz alzada", "faroles", "farol", "pertiga", "vara", "bocina"],
        "category": "orfebreria",
        "intro": [
            "Ciriales, cruces de guía, faroles de acompañamiento, varas de presidencia, pértigas y "
            "bocinas para cortejos procesionales.",
            "Revisa la altura total, el material de la caña y si las piezas llegan completas. Para varas "
            "y bocinas, pregunta de qué hermandad son y si llevan el escudo grabado.",
        ],
        "related": ["orfebreria-cofrade", "estandartes-y-simpecados", "incensarios-y-navetas"],
    },
    {
        "slug": "candelabros-y-candeleros",
        "name": "Candelabros y candeleros",
        "keywords": ["candelabro", "candelero", "tulipa", "arbotante", "guardabrisa", "blandon", "hachon"],
        "category": "orfebreria",
        "intro": [
            "Candelabros de guardabrisas, candeleros de altar, arbotantes, tulipas, blandones y hachones "
            "para pasos, altares de culto y capillas.",
            "Cuenta los brazos o puntos de luz, mide la altura y pregunta si incluye los guardabrisas o "
            "tulipas de cristal, que son lo más delicado a la hora de transportarlos.",
        ],
        "related": ["orfebreria-cofrade", "cirios-y-cera", "paso-de-misterio"],
    },
    {
        "slug": "incensarios-y-navetas",
        "name": "Incensarios y navetas",
        "keywords": ["incensario", "naveta", "turibulo", "incienso", "carbon", "acetre", "hisopo"],
        "category": "orfebreria",
        "intro": [
            "Incensarios, navetas, acetres e hisopos para cultos y cortejos, además de incienso y "
            "carboncillos para la estación de penitencia.",
            "Comprueba que las cadenas y la tapa estén completas y que el cuerpo no tenga grietas. "
            "Los juegos de incensario y naveta del mismo taller suelen venderse juntos.",
        ],
        "related": ["dalmaticas-y-ropa-de-acolito", "orfebreria-cofrade", "ciriales-y-cruz-de-guia"],
    },
    {
        "slug": "estandartes-y-simpecados",
        "name": "Estandartes y simpecados",
        "keywords": ["estandarte", "simpecado", "guion", "bandera", "bacalao", "senatus", "banderin", "libro de reglas"],
        "category": "bordados",
        "intro": [
            "Estandartes, simpecados, guiones (el \"bacalao\"), senatus, banderas y banderines de "
            "hermandades y asociaciones, bordados o pintados.",
            "Pregunta por las medidas del paño, el estado del bordado y si incluye asta y remate. "
            "Muchas piezas antiguas se venden para restaurarlas o para exponerlas en casas de hermandad.",
        ],
        "related": ["bordados-cofrades", "ciriales-y-cruz-de-guia", "antiguedades-religiosas"],
    },
    {
        "slug": "cingulos-y-complementos-de-nazareno",
        "name": "Cíngulos y complementos de nazareno",
        "keywords": ["cingulo", "fajin", "guantes", "sandalias", "esparto", "zapatos", "capa", "cordon"],
        "category": "complementos",
        "intro": [
            "Cíngulos, fajines, guantes, sandalias, alpargatas de esparto, zapatos, capas y todo lo que "
            "completa el hábito de nazareno.",
            "Los complementos cambian mucho de una hermandad a otra: comprueba el color y el modelo que "
            "marcan tus reglas antes de comprar.",
        ],
        "related": ["tunicas-de-nazareno", "capirotes", "medallas-de-hermandad"],
    },
    {
        "slug": "costales-y-ropa-de-costalero",
        "name": "Costales y ropa de costalero",
        "keywords": ["costal", "costalero", "faja", "morcilla", "ropa de costalero", "alpargata", "calzona", "portador"],
        "category": "complementos",
        "intro": [
            "Costales, fajas, morcillas, alpargatas y ropa de costalero, además de ropa y material "
            "para portadores de trono.",
            "Pregunta por el tejido del costal y el largo de la faja. Para ensayos y salidas, muchos "
            "costaleros prefieren material de segunda mano ya domado.",
        ],
        "related": ["pasos-procesionales", "paso-de-misterio", "paso-de-palio"],
    },
    {
        "slug": "dalmaticas-y-ropa-de-acolito",
        "name": "Dalmáticas y ropa de acólito",
        "keywords": ["dalmatica", "acolito", "monaguillo", "alba", "roquete", "sotana", "pertiguero", "casulla"],
        "category": "tunicas-capirotes",
        "intro": [
            "Dalmáticas, albas, roquetes, sotanas y ropa para acólitos, monaguillos y pertigueros, "
            "además de ornamentos litúrgicos como casullas.",
            "Fíjate en las tallas y en el color litúrgico. Las hermandades suelen comprar lotes de "
            "dalmáticas iguales para todo el cuerpo de acólitos.",
        ],
        "related": ["incensarios-y-navetas", "tunicas-de-nazareno", "ciriales-y-cruz-de-guia"],
    },
    {
        "slug": "miniaturas-cofrades",
        "name": "Miniaturas cofrades",
        "keywords": ["miniatura", "maqueta", "pasito", "paso infantil", "paso en miniatura", "cruz de mayo", "miniaturas"],
        "category": "imagenes-figuras",
        "intro": [
            "Pasos en miniatura, maquetas, imágenes pequeñas y pasitos infantiles o de cruz de mayo, "
            "para coleccionistas y para los más pequeños de la casa.",
            "Pregunta por la escala, los materiales y si las imágenes van incluidas. Las miniaturas "
            "hechas a mano por artesanos cofrades son piezas muy buscadas.",
        ],
        "related": ["paso-de-misterio", "imagenes-religiosas", "belenes-y-nacimientos"],
    },
    {
        "slug": "crucifijos",
        "name": "Crucifijos",
        "keywords": ["crucifijo", "crucificado", "cristo", "cruz"],
        "category": "imagenes-figuras",
        "intro": [
            "Crucifijos de pared y de mesa, crucificados en madera y cruces de altar, antiguos y modernos.",
            "Pregunta por la medida del Cristo y de la cruz, el material y si la policromía es original.",
        ],
        "related": ["imagenes-religiosas", "antiguedades-religiosas", "rosarios"],
    },
    {
        "slug": "imagenes-de-la-virgen",
        "name": "Imágenes de la Virgen",
        "keywords": ["virgen", "dolorosa", "inmaculada", "maria", "nuestra señora", "virgen del rocio", "virgen de vestir"],
        "category": "imagenes-figuras",
        "intro": [
            "Imágenes de la Virgen en venta: dolorosas, inmaculadas, imágenes de vestir y de talla "
            "completa, cuadros y relieves marianos.",
            "Si es una imagen de vestir, pide medidas del candelero y pregunta si incluye ajuar. "
            "En imágenes de talla, fíjate en el estado de la policromía y del estofado.",
        ],
        "related": ["mantos-y-sayas", "coronas-y-potencias", "imagenes-religiosas"],
    },
    {
        "slug": "belenes-y-nacimientos",
        "name": "Belenes y nacimientos",
        "keywords": ["belen", "nacimiento", "pesebre", "figuras de belen", "reyes magos", "misterio de belen"],
        "category": "imagenes-figuras",
        "intro": [
            "Figuras de belén, nacimientos completos, misterios, Reyes Magos y complementos para montar "
            "el belén en casa o en la hermandad.",
            "Pregunta por la escala de las figuras (en centímetros), el material y si la pintura está "
            "hecha a mano. Los lotes de belén completos suelen salir más baratos que por piezas.",
        ],
        "related": ["imagenes-religiosas", "miniaturas-cofrades", "antiguedades-religiosas"],
    },
    {
        "slug": "rosarios",
        "name": "Rosarios",
        "keywords": ["rosario", "decenario", "camandula"],
        "category": "insignias-medallas",
        "intro": [
            "Rosarios de plata, de nácar, de madera y de cristal, decenarios y rosarios antiguos o de "
            "recuerdo de hermandades y santuarios.",
            "Si el vendedor indica que es de plata, pide foto del punzón. Los rosarios antiguos se "
            "valoran por el material de las cuentas y por la cruz.",
        ],
        "related": ["medallas-de-hermandad", "crucifijos", "antiguedades-religiosas"],
    },
    {
        "slug": "mantillas-y-peinetas",
        "name": "Mantillas y peinetas",
        "keywords": ["mantilla", "peineta", "teja", "mantilla española", "encaje"],
        "category": "complementos",
        "intro": [
            "Mantillas negras y blancas, peinetas de carey o de acetato y complementos para el Jueves "
            "y el Viernes Santo.",
            "En las mantillas mira el largo, el tipo de encaje y si tiene alguna rotura. En las peinetas, "
            "la altura y si llevan la teja completa.",
        ],
        "related": ["cingulos-y-complementos-de-nazareno", "medallas-de-hermandad"],
    },
    {
        "slug": "uniformes-de-banda",
        "name": "Uniformes de banda",
        "keywords": ["uniforme", "uniformes de banda", "gorra de plato", "guerrera", "pechera", "casaca"],
        "category": "instrumentos-musicales",
        "intro": [
            "Uniformes de bandas de cornetas y tambores y de agrupaciones musicales: guerreras, gorras "
            "de plato, pecheras y complementos.",
            "Las bandas suelen renovar el uniforme por completo, así que es fácil encontrar lotes con "
            "varias tallas. Pregunta cuántas unidades hay de cada talla.",
        ],
        "related": ["instrumentos-de-banda-cofrade", "libros-y-carteles-cofrades"],
    },
    {
        "slug": "libros-y-carteles-cofrades",
        "name": "Libros y carteles cofrades",
        "keywords": ["libro", "cartel", "revista", "boletin", "grabado", "lamina", "estampa", "programa de mano", "cuadro"],
        "category": "otros",
        "intro": [
            "Libros de Semana Santa y de hermandades, carteles, revistas, boletines, grabados, láminas, "
            "estampas y programas de mano antiguos y actuales.",
            "Para coleccionistas importan el año, la edición y el estado del papel. Si es un cartel, "
            "pregunta el tamaño y si va enmarcado.",
        ],
        "related": ["antiguedades-religiosas", "instrumentos-de-banda-cofrade", "medallas-de-hermandad"],
    },
    {
        "slug": "antiguedades-religiosas",
        "name": "Antigüedades religiosas",
        "keywords": ["antiguo", "antigua", "antiguedad", "siglo", "epoca", "barroco", "xviii", "xix"],
        "category": None,
        "intro": [
            "Antigüedades religiosas y arte sacro: orfebrería, imaginería, bordados, libros, relicarios "
            "y objetos de culto con historia.",
            "En piezas antiguas pide toda la información que tenga el vendedor sobre su procedencia y, "
            "si la hay, documentación o tasación. Las fotos de detalle ayudan mucho a valorar el estado.",
        ],
        "related": ["orfebreria-cofrade", "imagenes-religiosas", "bordados-cofrades", "libros-y-carteles-cofrades"],
    },
]

# ---------------------------------------------------------------------------
# Búsquedas concretas (cuelgan de una general con "parent")
# ---------------------------------------------------------------------------
_VIRGEN = ["virgen", "dolorosa", "inmaculada", "nuestra señora", "maria santisima"]
_ANTIGUO = ["antiguo", "antigua", "antiguedad", "siglo", "xvii", "xviii", "xix", "epoca"]

LANDINGS += [
    # ---- Imágenes ----
    {
        "slug": "virgen-de-candelero",
        "name": "Vírgenes de candelero",
        "parent": "imagenes-de-la-virgen",
        "must": [_VIRGEN + ["imagen", "talla"], ["candelero", "de vestir", "para vestir"]],
        "category": "imagenes-figuras",
        "intro": [
            "Imágenes de la Virgen de candelero o de vestir: dolorosas y vírgenes de gloria con el cuerpo "
            "en candelero, listas para vestir con saya, manto y tocado.",
            "Pregunta la altura total, si los brazos son articulados, si el pelo es tallado o lleva peluca "
            "y si se vende con ajuar. Muchas son imágenes de devoción particular muy cuidadas.",
        ],
        "related": ["mantos-y-sayas", "coronas-y-potencias", "virgen-siglo-xviii"],
    },
    {
        "slug": "virgen-siglo-xviii",
        "name": "Vírgenes del siglo XVIII",
        "parent": "imagenes-de-la-virgen",
        "must": [_VIRGEN, ["xviii", "siglo 18", "dieciocho", "setecientos"]],
        "category": "imagenes-figuras",
        "intro": [
            "Imágenes marianas del siglo XVIII: dolorosas, inmaculadas y vírgenes de gloria del barroco, "
            "en talla completa o de vestir, además de pinturas y relieves de esa época.",
            "En una pieza de esta antigüedad pide toda la información que tenga el vendedor: procedencia, "
            "restauraciones y si tiene estudio o atribución a algún taller o escuela. Las fotos de detalle "
            "de rostro, manos y reverso ayudan a valorar el estado.",
        ],
        "related": ["virgen-siglo-xix", "imagen-antigua", "antiguedades-religiosas"],
    },
    {
        "slug": "virgen-siglo-xix",
        "name": "Vírgenes del siglo XIX",
        "parent": "imagenes-de-la-virgen",
        "must": [_VIRGEN, ["xix", "siglo 19", "diecinueve", "ochocientos"]],
        "category": "imagenes-figuras",
        "intro": [
            "Vírgenes del siglo XIX en venta: imágenes de vestir y de talla, dolorosas de capilla y de "
            "oratorio doméstico, muchas de devoción familiar que han pasado de generación en generación.",
            "El siglo XIX dejó muchas imágenes de pequeño y mediano formato para casas y conventos. Pregunta "
            "por la altura, el material (madera, pasta de madera, terracota) y el estado de la policromía y "
            "de los ojos de cristal.",
        ],
        "related": ["virgen-siglo-xviii", "virgen-de-candelero", "imagen-antigua"],
    },
    {
        "slug": "nino-jesus",
        "name": "Niños Jesús",
        "parent": "imagenes-religiosas",
        "keywords": ["niño jesus", "niño dios", "divino infante", "niño de pasion", "niño de praga", "jesus niño"],
        "category": "imagenes-figuras",
        "intro": [
            "Imágenes del Niño Jesús: niños de talla y de vestir, Niños de Pasión, Divino Infante y Niños "
            "Jesús de Praga, con su ropa y complementos.",
            "Pregunta la altura, si trae peana o cojín y si incluye ropa y potencias. Los Niños Jesús "
            "antiguos de convento son muy buscados por coleccionistas.",
        ],
        "related": ["imagenes-religiosas", "belenes-y-nacimientos", "imagenes-de-santos"],
    },
    {
        "slug": "imagenes-de-santos",
        "name": "Imágenes de santos",
        "parent": "imagenes-religiosas",
        "keywords": ["san jose", "san juan", "san antonio", "santa ana", "san roque", "san judas tadeo",
                     "san miguel", "santa rita", "san pancracio", "santa lucia"],
        "category": "imagenes-figuras",
        "intro": [
            "Imágenes de santos y santas: San José, San Juan Evangelista, San Antonio, Santa Ana, San Judas "
            "Tadeo y muchas más devociones, de talla, de vestir o de escayola.",
            "Pide la altura y el material. Las de escayola o resina pesan menos y son más económicas; las de "
            "madera son más delicadas y conviene revisar la policromía.",
        ],
        "related": ["imagenes-religiosas", "nino-jesus", "imagenes-de-olot"],
    },
    {
        "slug": "imagenes-de-olot",
        "name": "Imágenes de Olot",
        "parent": "imagenes-religiosas",
        "keywords": ["olot", "arte cristiano"],
        "category": "imagenes-figuras",
        "intro": [
            "Imágenes religiosas de Olot: los talleres de esta ciudad, como El Arte Cristiano, llenaron "
            "iglesias y hogares de toda España de imágenes policromadas en pasta de madera, cartón piedra "
            "y escayola.",
            "Muchas llevan la etiqueta o el sello del taller en la base: pide una foto. Revisa desconchones "
            "en la policromía y el estado de dedos y atributos, que es lo primero que se rompe.",
        ],
        "related": ["imagenes-de-santos", "imagenes-religiosas", "antiguedades-religiosas"],
    },
    {
        "slug": "angeles-y-querubines",
        "name": "Ángeles y querubines",
        "parent": "imagenes-religiosas",
        "keywords": ["angel", "querubin", "angelito", "lampadario", "cabeza de angel", "arcangel"],
        "category": "imagenes-figuras",
        "intro": [
            "Ángeles, querubines y cabezas de angelitos para pasos, retablos y altares: ángeles lampadarios, "
            "ángeles pasionistas con los atributos de la Pasión y querubines tallados.",
            "Pregunta la medida, el tipo de sujeción (espiga o tornillo) y si se venden por parejas.",
        ],
        "related": ["paso-de-misterio", "imagenes-religiosas", "canastillas"],
    },
    {
        "slug": "crucificado-de-madera",
        "name": "Crucificados de madera",
        "parent": "crucifijos",
        "must": [["crucificado", "cristo", "crucifijo"], ["madera", "talla", "tallado"]],
        "category": "imagenes-figuras",
        "intro": [
            "Crucificados tallados en madera para capillas, oratorios, casas de hermandad y colecciones, "
            "desde crucifijos de mesa hasta Cristos de tamaño natural.",
            "Fíjate en la medida del Cristo (no solo de la cruz), en si la cruz es la original y en el estado "
            "de la policromía y de los dedos. Pregunta si la talla está atribuida a algún imaginero.",
        ],
        "related": ["crucifijos", "imagen-antigua", "imagenes-religiosas"],
    },
    {
        "slug": "imagen-antigua",
        "name": "Imaginería antigua",
        "parent": "antiguedades-religiosas",
        "must": [["imagen", "talla", "escultura", "cristo", "virgen", "santo", "niño jesus", "crucificado", "busto"], _ANTIGUO],
        "category": "imagenes-figuras",
        "intro": [
            "Imaginería antigua en venta: tallas de los siglos XVII, XVIII y XIX, imágenes de vestir antiguas, "
            "bustos y relieves para coleccionistas, hermandades y anticuarios.",
            "Una buena descripción dice qué se sabe de la pieza y qué no. Pide fotos del reverso, de la base y "
            "de cualquier inscripción, y pregunta si ha pasado por un restaurador.",
        ],
        "related": ["virgen-siglo-xviii", "crucificado-de-madera", "orfebreria-antigua"],
    },
    {
        "slug": "relicarios",
        "name": "Relicarios",
        "parent": "antiguedades-religiosas",
        "keywords": ["relicario", "reliquia", "teca", "portarreliquias"],
        "category": "orfebreria",
        "intro": [
            "Relicarios, tecas y portarreliquias de plata, metal dorado o madera, antiguos y modernos.",
            "Si conserva la reliquia, pregunta si tiene su auténtica, el documento que la acredita. Revisa "
            "también el cristal y el cierre.",
        ],
        "related": ["orfebreria-antigua", "vasos-sagrados", "antiguedades-religiosas"],
    },
    # ---- Orfebrería ----
    {
        "slug": "vasos-sagrados",
        "name": "Cálices y vasos sagrados",
        "parent": "orfebreria-cofrade",
        "keywords": ["caliz", "copon", "patena", "custodia", "ostensorio", "vinajeras", "vasos sagrados"],
        "category": "orfebreria",
        "intro": [
            "Cálices, copones, patenas, custodias, vinajeras y vasos sagrados para parroquias, capillas y "
            "coleccionistas.",
            "En piezas de plata pide foto de los punzones. Los cálices llevan la copa dorada por dentro: "
            "pregunta si el dorado está en buen estado.",
        ],
        "related": ["plata-de-ley", "sagrarios", "orfebreria-antigua"],
    },
    {
        "slug": "plata-de-ley",
        "name": "Plata de ley religiosa",
        "parent": "orfebreria-cofrade",
        "keywords": ["plata de ley", "plata 916", "plata 925", "punzon", "contraste", "plata maciza"],
        "category": "orfebreria",
        "intro": [
            "Piezas religiosas y cofrades de plata de ley: coronas, medallas, candeleros, cálices, relicarios "
            "y objetos de culto con su contraste.",
            "La plata de ley española lleva punzones: la ley (916 o 925) y la marca del platero o del taller. "
            "Pide siempre foto de esas marcas y, si es una pieza de valor, el peso.",
        ],
        "related": ["medallas-de-plata", "orfebreria-antigua", "vasos-sagrados"],
    },
    {
        "slug": "jarras-de-palio",
        "name": "Jarras de palio",
        "parent": "paso-de-palio",
        "keywords": ["jarras de palio", "jarra", "anfora", "jarrita"],
        "category": "orfebreria",
        "intro": [
            "Jarras de palio y ánforas para el exorno floral del paso de la Virgen, en plata, metal plateado "
            "o dorado, sueltas o por juegos.",
            "Cuenta cuántas son, mide la altura y la boca y pregunta si llevan recipiente interior para las "
            "flores. Los juegos completos del mismo orfebre valen más que las piezas sueltas.",
        ],
        "related": ["varales-de-palio", "candeleria-de-palio", "paso-de-palio"],
    },
    {
        "slug": "varales-de-palio",
        "name": "Varales de palio",
        "parent": "paso-de-palio",
        "keywords": ["varales de palio", "varal"],
        "category": "pasos",
        "intro": [
            "Varales de palio en juegos completos, normalmente de doce, o por unidades, de orfebrería "
            "repujada, cincelada o lisa.",
            "Indica la altura que necesitas y el diámetro de la caña, y pregunta cómo se sujetan a la mesa "
            "del paso y al techo de palio.",
        ],
        "related": ["bambalinas-y-techo-de-palio", "jarras-de-palio", "paso-de-palio"],
    },
    {
        "slug": "respiraderos",
        "name": "Respiraderos",
        "parent": "pasos-procesionales",
        "keywords": ["respiradero"],
        "category": "pasos",
        "intro": [
            "Respiraderos para pasos de palio y de misterio, de orfebrería o de talla dorada, completos o por "
            "frentes y costeros.",
            "Mide el perímetro del paso y la altura del respiradero. Pregunta si tiene capillas o cartelas con "
            "imágenes y si hay piezas por restaurar.",
        ],
        "related": ["paso-de-palio", "canastillas", "parihuelas"],
    },
    {
        "slug": "candeleria-de-palio",
        "name": "Candelería de palio",
        "parent": "paso-de-palio",
        "keywords": ["candeleria", "candelero de palio", "tanda de cera", "tandas"],
        "category": "orfebreria",
        "intro": [
            "Candelería para palio: juegos de candeleros ordenados por tandas, en plata o metal plateado, "
            "para iluminar el paso de la Virgen.",
            "Cuenta el número de candeleros y de tandas y pregunta si todos son iguales o de varias alturas. "
            "Para la cera, mira también las búsquedas de cera rizada.",
        ],
        "related": ["cera-rizada", "jarras-de-palio", "paso-de-palio"],
    },
    {
        "slug": "peanas",
        "name": "Peanas",
        "parent": "pasos-procesionales",
        "keywords": ["peana"],
        "category": "orfebreria",
        "intro": [
            "Peanas para imágenes de plata, metal dorado o madera tallada y dorada, para pasos, altares de "
            "cultos y capillas.",
            "La medida clave es la superficie de apoyo de la imagen. Pregunta también la altura y si lleva "
            "cartelas o el escudo de alguna hermandad.",
        ],
        "related": ["paso-de-palio", "candelabros-y-candeleros", "imagenes-de-la-virgen"],
    },
    {
        "slug": "potencias-de-cristo",
        "name": "Potencias de Cristo",
        "parent": "coronas-y-potencias",
        "keywords": ["potencias"],
        "category": "orfebreria",
        "intro": [
            "Potencias para el Señor: juegos de tres rayos en plata, metal dorado o plateado, para "
            "crucificados, Cristos de Pasión y Nazarenos.",
            "Mide el diámetro de la cabeza y fíjate en la sujeción (espigas o tornillo). Los juegos antiguos "
            "de plata suelen llevar punzón.",
        ],
        "related": ["coronas-y-potencias", "crucificado-de-madera", "plata-de-ley"],
    },
    {
        "slug": "sagrarios",
        "name": "Sagrarios",
        "parent": "orfebreria-cofrade",
        "keywords": ["sagrario", "tabernaculo", "expositor"],
        "category": "orfebreria",
        "intro": [
            "Sagrarios de madera tallada y dorada, de metal o de plata, y expositores para capillas, "
            "oratorios y parroquias.",
            "Pregunta las medidas interiores y exteriores, si conserva la llave y el estado del dorado. En "
            "sagrarios antiguos, revisa si hay carcoma.",
        ],
        "related": ["vasos-sagrados", "candelabros-y-candeleros", "antiguedades-religiosas"],
    },
    {
        "slug": "atriles-y-misales",
        "name": "Atriles y misales",
        "parent": "libros-y-carteles-cofrades",
        "keywords": ["atril", "misal", "evangeliario", "libro de reglas"],
        "category": "otros",
        "intro": [
            "Atriles de altar y de coro, misales, evangeliarios y libros de reglas, algunos con cubiertas de "
            "orfebrería o de terciopelo bordado.",
            "En los libros antiguos pregunta el año y el estado de las hojas y de la encuadernación. En los "
            "atriles, el material y si es plegable.",
        ],
        "related": ["libros-y-carteles-cofrades", "vasos-sagrados", "estandartes-y-simpecados"],
    },
    # ---- Bordados ----
    {
        "slug": "sayas-bordadas",
        "name": "Sayas bordadas",
        "parent": "mantos-y-sayas",
        "must": [["saya"], ["bordada", "bordado", "oro", "sedas"]],
        "category": "bordados",
        "intro": [
            "Sayas bordadas en oro y sedas para imágenes de la Virgen, de salida y de camarín, sobre "
            "terciopelo, tisú o raso.",
            "Pide el largo, el contorno de cintura y la medida de las mangas si las tiene. En sayas antiguas, "
            "pregunta si el bordado se ha pasado a nuevo soporte.",
        ],
        "related": ["mantos-y-sayas", "tocas-de-sobremanto", "bordados-antiguos"],
    },
    {
        "slug": "bambalinas-y-techo-de-palio",
        "name": "Bambalinas y techos de palio",
        "parent": "paso-de-palio",
        "keywords": ["bambalina", "techo de palio", "gloria de palio"],
        "category": "bordados",
        "intro": [
            "Bambalinas delanteras, traseras y laterales y techos de palio, bordados o lisos, de malla, "
            "terciopelo o tisú.",
            "Indica las medidas de tu palio: largo de cada bambalina, caída y número de varales. Pregunta si "
            "el techo incluye la gloria y si todas las piezas son del mismo conjunto.",
        ],
        "related": ["varales-de-palio", "paso-de-palio", "bordados-cofrades"],
    },
    {
        "slug": "faldones",
        "name": "Faldones para pasos",
        "parent": "pasos-procesionales",
        "keywords": ["faldon"],
        "category": "bordados",
        "intro": [
            "Faldones para pasos de misterio y de Cristo, de terciopelo liso o bordado, con sus cartelas y "
            "escudos.",
            "Mide el perímetro del paso y la altura desde la canastilla hasta el suelo, y pregunta cómo se "
            "fijan: velcro, corchetes o clavos.",
        ],
        "related": ["canastillas", "paso-de-misterio", "bordados-cofrades"],
    },
    {
        "slug": "bordados-antiguos",
        "name": "Bordados antiguos",
        "parent": "bordados-cofrades",
        "must": [["bordado", "bordada"], _ANTIGUO],
        "category": "bordados",
        "intro": [
            "Bordados antiguos en oro y sedas: piezas de mantos, sayas, estandartes, dalmáticas y ornamentos "
            "litúrgicos de los siglos XVIII, XIX y XX.",
            "Muchas piezas se compran para pasarlas a nuevo soporte o para enmarcarlas. Pide fotos de cerca "
            "del hilo y del tejido de fondo, y pregunta si hay zonas perdidas.",
        ],
        "related": ["sayas-bordadas", "estandartes-y-simpecados", "antiguedades-religiosas"],
    },
    {
        "slug": "tocas-de-sobremanto",
        "name": "Tocas de sobremanto",
        "parent": "mantos-y-sayas",
        "keywords": ["toca de sobremanto", "sobremanto", "toca", "encaje de bolillos", "blonda"],
        "category": "bordados",
        "intro": [
            "Tocas de sobremanto y encajes para vestir a la Virgen: tul bordado, encaje de bolillos y blondas "
            "antiguas.",
            "Mide el largo y el ancho y pregunta el tipo de encaje. Los encajes antiguos deben guardarse sin "
            "doblar y lejos de la luz.",
        ],
        "related": ["mantos-y-sayas", "sayas-bordadas", "mantillas-y-peinetas"],
    },
    # ---- Túnicas ----
    {
        "slug": "tunica-nazareno-nino",
        "name": "Túnicas de nazareno de niño",
        "parent": "tunicas-de-nazareno",
        "must": [["tunica", "nazareno", "habito"], ["niño", "niña", "infantil", "años", "pequeño", "pequeña"]],
        "category": "tunicas-capirotes",
        "intro": [
            "Túnicas de nazareno infantiles para niños y niñas, con su antifaz o su capirote pequeño, por "
            "edades y tallas.",
            "Los niños crecen rápido y la túnica de segunda mano tiene todo el sentido. Pide el largo total y "
            "la edad aproximada, y comprueba que es de tu hermandad.",
        ],
        "related": ["tunicas-de-nazareno", "capirotes", "paso-infantil"],
    },
    {
        "slug": "tunica-de-cola",
        "name": "Túnicas de cola",
        "parent": "tunicas-de-nazareno",
        "must": [["tunica", "habito", "nazareno"], ["cola"]],
        "category": "tunicas-capirotes",
        "intro": [
            "Túnicas de cola en venta: el hábito de nazareno con cola que visten muchas hermandades, sobre "
            "todo cofradías de negro.",
            "Pregunta el largo de la cola, el tejido y si incluye el antifaz. Tiene que coincidir exactamente "
            "con lo que exigen las reglas de tu hermandad.",
        ],
        "related": ["tunicas-de-nazareno", "tunica-de-terciopelo", "antifaz"],
    },
    {
        "slug": "tunica-de-terciopelo",
        "name": "Túnicas de terciopelo",
        "parent": "tunicas-de-nazareno",
        "must": [["tunica", "habito"], ["terciopelo"]],
        "category": "tunicas-capirotes",
        "intro": [
            "Túnicas de terciopelo para nazareno, en distintos colores, con o sin capa, de las hermandades que "
            "usan este tejido.",
            "El terciopelo marca con facilidad: pide fotos con luz natural y pregunta si hay roces o brillos en "
            "codos y bajos. Guárdala colgada, nunca doblada.",
        ],
        "related": ["tunica-de-cola", "capa-de-nazareno", "tunicas-de-nazareno"],
    },
    {
        "slug": "tunica-de-ruan",
        "name": "Túnicas de ruan",
        "parent": "tunicas-de-nazareno",
        "must": [["tunica", "habito"], ["ruan"]],
        "category": "tunicas-capirotes",
        "intro": [
            "Túnicas de ruan: un tejido ligero y fresco, muy usado por las hermandades de Andalucía para "
            "túnicas y capas.",
            "Pregunta el tejido exacto, el color y el largo, y cómo la ha lavado el vendedor: algunos tejidos "
            "naturales encogen.",
        ],
        "related": ["tunicas-de-nazareno", "tunica-de-cola", "cingulos-y-complementos-de-nazareno"],
    },
    {
        "slug": "capa-de-nazareno",
        "name": "Capas de nazareno",
        "parent": "cingulos-y-complementos-de-nazareno",
        "must": [["capa"], ["nazareno", "tunica", "hermandad", "escudo"]],
        "category": "complementos",
        "intro": [
            "Capas de nazareno con o sin escudo bordado, en lana, sarga o terciopelo, para completar el hábito.",
            "Comprueba que el color y el escudo son los de tu hermandad y pide el largo. Si el escudo es "
            "bordado, pregunta si se puede descoser para cambiarlo.",
        ],
        "related": ["tunicas-de-nazareno", "tunica-de-terciopelo", "antifaz"],
    },
    {
        "slug": "antifaz",
        "name": "Antifaces de nazareno",
        "parent": "capirotes",
        "keywords": ["antifaz", "antifaces"],
        "category": "tunicas-capirotes",
        "intro": [
            "Antifaces de nazareno de distintos colores y tejidos, lisos o con el escudo bordado de la "
            "hermandad.",
            "Pregunta la medida del antifaz y el tamaño del capirote al que va destinado.",
        ],
        "related": ["capirotes", "tunicas-de-nazareno", "capa-de-nazareno"],
    },
    # ---- Cera ----
    {
        "slug": "cirio-de-nazareno",
        "name": "Cirios de nazareno",
        "parent": "cirios-y-cera",
        "must": [["cirio", "vela"], ["nazareno", "penitencia", "procesion", "hermandad"]],
        "category": "cirios-velas",
        "intro": [
            "Cirios de nazareno para la estación de penitencia, de cera blanca o de color, lisos o rizados, "
            "sueltos o por lotes.",
            "Comprueba que el color y el diámetro son los que pide tu hermandad. Muchas hermandades venden "
            "cirios sobrantes de años anteriores.",
        ],
        "related": ["cera-rizada", "tunicas-de-nazareno", "cirios-y-cera"],
    },
    {
        "slug": "cera-rizada",
        "name": "Cera rizada",
        "parent": "cirios-y-cera",
        "keywords": ["cera rizada", "vela rizada", "cirio rizado", "rizada", "rizado"],
        "category": "cirios-velas",
        "intro": [
            "Cera rizada: cirios y velas con el característico rizado, para candelería de palio, altares de "
            "cultos y candeleros.",
            "Pregunta el diámetro, la altura y el color. La cera rizada es delicada: guárdala en vertical y en "
            "un lugar fresco.",
        ],
        "related": ["candeleria-de-palio", "cirio-de-nazareno", "cirios-y-cera"],
    },
    {
        "slug": "incienso",
        "name": "Incienso",
        "parent": "incensarios-y-navetas",
        "keywords": ["incienso", "carboncillo", "carbon"],
        "category": "cirios-velas",
        "intro": [
            "Incienso para cultos y procesiones: mezclas de resinas, incienso de iglesia y carboncillos de "
            "encendido rápido.",
            "Pregunta el tipo de mezcla y el peso. Guárdalo bien cerrado y en un lugar seco para que conserve "
            "el aroma.",
        ],
        "related": ["incensarios-y-navetas", "dalmaticas-y-ropa-de-acolito", "cirios-y-cera"],
    },
    # ---- Insignias ----
    {
        "slug": "medallas-de-plata",
        "name": "Medallas de hermandad de plata",
        "parent": "medallas-de-hermandad",
        "must": [["medalla"], ["plata"]],
        "category": "insignias-medallas",
        "intro": [
            "Medallas de hermandad de plata de ley, con su cordón o sin él, antiguas y actuales.",
            "Pide foto del reverso y del punzón. En las medallas antiguas, el cordón original y el buen estado "
            "del esmalte suben mucho el valor.",
        ],
        "related": ["medallas-de-hermandad", "plata-de-ley", "rosarios"],
    },
    {
        "slug": "varas-de-hermandad",
        "name": "Varas de hermandad",
        "parent": "ciriales-y-cruz-de-guia",
        "keywords": ["vara de presidencia", "varas de hermandad", "vara"],
        "category": "insignias-medallas",
        "intro": [
            "Varas de hermandad: varas de presidencia, de diputado y de oficial, con su remate de orfebrería "
            "y el escudo de la corporación.",
            "Pregunta la altura total, el material del remate y de la caña, y si el escudo se puede cambiar. "
            "Muchas hermandades renuevan sus varas y venden las antiguas.",
        ],
        "related": ["ciriales-y-cruz-de-guia", "estandartes-y-simpecados", "medallas-de-hermandad"],
    },
    # ---- Pasos ----
    {
        "slug": "llamador-de-paso",
        "name": "Llamadores de paso",
        "parent": "pasos-procesionales",
        "keywords": ["llamador"],
        "category": "orfebreria",
        "intro": [
            "Llamadores de paso en plata, metal plateado o bronce, con los que el capataz da las órdenes a la "
            "cuadrilla.",
            "Pregunta la medida, cómo se fija al paso y si lleva escudo o algún motivo de la hermandad. Son "
            "también un regalo muy apreciado por capataces y costaleros.",
        ],
        "related": ["costales-y-ropa-de-costalero", "paso-de-misterio", "respiraderos"],
    },
    {
        "slug": "tronos",
        "name": "Tronos de Semana Santa",
        "parent": "pasos-procesionales",
        "keywords": ["trono", "hombres de trono", "varales de trono"],
        "category": "pasos",
        "intro": [
            "Tronos de Semana Santa: así se llama al paso en Málaga y en buena parte de Andalucía oriental, "
            "portado a hombros por los hombres de trono.",
            "En un trono importan las medidas, el número de varales y de portadores y el estado del tallado y "
            "del dorado. Pregunta qué elementos se incluyen: arbotantes, cartelas, candelabros.",
        ],
        "related": ["pasos-procesionales", "costales-y-ropa-de-costalero", "candelabros-y-candeleros"],
    },
    {
        "slug": "parihuelas",
        "name": "Parihuelas",
        "parent": "pasos-procesionales",
        "keywords": ["parihuela", "mesa de paso"],
        "category": "pasos",
        "intro": [
            "Parihuelas y mesas de paso: la estructura de madera o metálica sobre la que se monta el paso y "
            "bajo la que van los costaleros.",
            "Indica el largo, el ancho y el número de trabajaderas. Pregunta por el material, el peso y el "
            "estado de las patas y los zancos.",
        ],
        "related": ["canastillas", "respiraderos", "costales-y-ropa-de-costalero"],
    },
    {
        "slug": "canastillas",
        "name": "Canastillas",
        "parent": "paso-de-misterio",
        "keywords": ["canastilla"],
        "category": "pasos",
        "intro": [
            "Canastillas talladas para pasos de misterio y de Cristo, doradas o en madera vista, con sus "
            "capillas y cartelas.",
            "Mide el perímetro y la altura, y pregunta si la canastilla se desmonta por piezas. Revisa el "
            "estado del dorado y si falta alguna pieza de talla.",
        ],
        "related": ["paso-de-misterio", "faldones", "parihuelas"],
    },
    {
        "slug": "figuras-secundarias-de-misterio",
        "name": "Figuras secundarias de misterio",
        "parent": "paso-de-misterio",
        "keywords": ["sayon", "soldado romano", "romano", "centurion", "apostol", "cirineo", "sanedrita", "judas"],
        "category": "imagenes-figuras",
        "intro": [
            "Figuras secundarias para misterios: sayones, soldados romanos, centuriones, apóstoles, sanedritas, "
            "cirineos y demás personajes que acompañan al Señor en el paso.",
            "Pregunta la altura en relación con la imagen principal, el material y si están vestidas o "
            "talladas. Muchas hermandades renuevan sus figuras y venden las antiguas.",
        ],
        "related": ["paso-de-misterio", "imagenes-religiosas", "canastillas"],
    },
    {
        "slug": "paso-infantil",
        "name": "Pasos infantiles",
        "parent": "miniaturas-cofrades",
        "must": [["paso", "pasito", "trono"], ["infantil", "niño", "niña", "pequeño", "colegio"]],
        "category": "pasos",
        "intro": [
            "Pasos infantiles y pasitos para que los niños tengan su propia procesión en el colegio, la "
            "parroquia o la calle.",
            "Pregunta las medidas, el peso y cuántos niños lo pueden portar. Muchos se venden con imagen, "
            "faldones y candelería.",
        ],
        "related": ["cruz-de-mayo", "miniaturas-cofrades", "tunica-nazareno-nino"],
    },
    {
        "slug": "cruz-de-mayo",
        "name": "Cruces de mayo",
        "parent": "miniaturas-cofrades",
        "keywords": ["cruz de mayo", "cruces de mayo"],
        "category": "pasos",
        "intro": [
            "Todo para la Cruz de Mayo: cruces, pasitos, faldones, candelería y exorno para la fiesta de las "
            "cruces de mayo.",
            "Es una tradición muy viva en Andalucía y muchos elementos pasan de un grupo a otro cada año. "
            "Pregunta las medidas y si se vende el conjunto completo.",
        ],
        "related": ["paso-infantil", "miniaturas-cofrades", "faldones"],
    },
    # ---- Instrumentos ----
    {
        "slug": "cornetas",
        "name": "Cornetas",
        "parent": "instrumentos-de-banda-cofrade",
        "keywords": ["corneta", "corneta de pistones", "corneta de llave"],
        "category": "instrumentos-musicales",
        "intro": [
            "Cornetas de pistones y de llave para bandas de cornetas y tambores, nuevas y de segunda mano.",
            "Pregunta la marca, la afinación y el estado de los pistones o de la llave. Comprueba que no haya "
            "abolladuras en la campana y que incluya boquilla y estuche.",
        ],
        "related": ["tambores-y-cajas", "uniformes-de-banda", "instrumentos-de-banda-cofrade"],
    },
    {
        "slug": "tambores-y-cajas",
        "name": "Tambores y cajas",
        "parent": "instrumentos-de-banda-cofrade",
        "keywords": ["tambor", "caja", "redoblante", "bombo", "timbal"],
        "category": "instrumentos-musicales",
        "intro": [
            "Tambores, cajas, bombos y timbales para bandas cofrades y agrupaciones musicales.",
            "Pregunta la medida del parche, el estado de los aros y de la bordonera, y si incluye correaje o "
            "arnés.",
        ],
        "related": ["cornetas", "uniformes-de-banda", "instrumentos-de-banda-cofrade"],
    },
    {
        "slug": "bombardinos-y-tubas",
        "name": "Bombardinos y tubas",
        "parent": "instrumentos-de-banda-cofrade",
        "keywords": ["bombardino", "tuba", "fliscorno", "trombon", "trompeta"],
        "category": "instrumentos-musicales",
        "intro": [
            "Bombardinos, tubas, fliscornos, trombones y trompetas para agrupaciones musicales y bandas de "
            "música.",
            "Pregunta la marca y el modelo, la afinación y el estado de pistones y bombas, y si ha pasado "
            "revisión en un taller.",
        ],
        "related": ["cornetas", "tambores-y-cajas", "uniformes-de-banda"],
    },
    # ---- Antigüedades y papel ----
    {
        "slug": "orfebreria-antigua",
        "name": "Orfebrería antigua",
        "parent": "antiguedades-religiosas",
        "must": [["plata", "orfebreria", "caliz", "custodia", "candelero", "relicario", "corona"], _ANTIGUO],
        "category": "orfebreria",
        "intro": [
            "Orfebrería religiosa antigua: cálices, custodias, candeleros, coronas, relicarios y piezas de "
            "plata de los siglos XVII al XIX.",
            "La plata antigua suele llevar punzones de localidad y de platero que permiten fecharla. Pide "
            "fotos de esas marcas y pregunta el peso.",
        ],
        "related": ["plata-de-ley", "vasos-sagrados", "imagen-antigua"],
    },
    {
        "slug": "exvotos",
        "name": "Exvotos",
        "parent": "antiguedades-religiosas",
        "keywords": ["exvoto"],
        "category": "otros",
        "intro": [
            "Exvotos: ofrendas de cera, plata, metal o pintura que los fieles dejaban en santuarios en "
            "agradecimiento por un favor recibido.",
            "Son piezas muy buscadas por coleccionistas de religiosidad popular. Pregunta de qué santuario "
            "proceden, si se sabe, y el material.",
        ],
        "related": ["antiguedades-religiosas", "relicarios", "estampas-y-recordatorios"],
    },
    {
        "slug": "estampas-y-recordatorios",
        "name": "Estampas y recordatorios",
        "parent": "libros-y-carteles-cofrades",
        "keywords": ["estampa", "estampita", "recordatorio", "postal"],
        "category": "otros",
        "intro": [
            "Estampas, estampitas, recordatorios y postales religiosas antiguas y actuales, sueltas o en "
            "colecciones.",
            "En estampas antiguas importan la imprenta, el año y el estado. Las colecciones de una misma "
            "hermandad o devoción valen más que las piezas sueltas.",
        ],
        "related": ["carteles-de-semana-santa", "libros-y-carteles-cofrades", "exvotos"],
    },
    {
        "slug": "carteles-de-semana-santa",
        "name": "Carteles de Semana Santa",
        "parent": "libros-y-carteles-cofrades",
        "keywords": ["cartel de semana santa", "cartel oficial", "cartel"],
        "category": "otros",
        "intro": [
            "Carteles de Semana Santa oficiales, de hermandades, de bandas y de salidas extraordinarias, de "
            "distintas ciudades y años.",
            "Pregunta la medida, si es una edición original o una reproducción y si va enmarcado. Los carteles "
            "oficiales de años antiguos se buscan mucho.",
        ],
        "related": ["estampas-y-recordatorios", "libros-y-carteles-cofrades", "uniformes-de-banda"],
    },
]

LANDINGS_BY_SLUG = {item["slug"]: item for item in LANDINGS}

# Búsqueda que corresponde a cada categoría de la web (para enlazar desde anuncios y listados).
CATEGORY_LANDING = {
    "tunicas-capirotes": "tunicas-de-nazareno",
    "cirios-velas": "cirios-y-cera",
    "orfebreria": "orfebreria-cofrade",
    "bordados": "bordados-cofrades",
    "imagenes-figuras": "imagenes-religiosas",
    "insignias-medallas": "medallas-de-hermandad",
    "instrumentos-musicales": "instrumentos-de-banda-cofrade",
    "complementos": "cingulos-y-complementos-de-nazareno",
    "pasos": "pasos-procesionales",
}

# Las que se enlazan en el pie de todas las páginas.
POPULAR = [
    "tunicas-de-nazareno",
    "paso-de-misterio",
    "paso-de-palio",
    "orfebreria-cofrade",
    "mantos-y-sayas",
    "medallas-de-hermandad",
    "costales-y-ropa-de-costalero",
    "miniaturas-cofrades",
]


def normalize(text: Optional[str]) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", text.lower()).strip()


def _pattern(keyword: str) -> re.Pattern:
    # Palabra completa, admite plural (s/es): "paso" encuentra "pasos" pero no "pasodoble".
    words = [re.escape(w) for w in normalize(keyword).split()]
    return re.compile(r"\b" + r"\s+".join(words) + r"(?:s|es)?\b")


def _keywords(item: dict) -> list[str]:
    if item.get("keywords"):
        return item["keywords"]
    return [k for group in item.get("must", []) for k in group]


_PATTERNS: dict[str, list[tuple[int, re.Pattern]]] = {}
_MUST: dict[str, list[list[re.Pattern]]] = {}


def _compile() -> None:
    _PATTERNS.clear()
    _MUST.clear()
    for item in LANDINGS:
        kws = _keywords(item)
        _PATTERNS[item["slug"]] = [(len(kws) - i, _pattern(k)) for i, k in enumerate(kws)]
        _MUST[item["slug"]] = [[_pattern(k) for k in group] for group in item.get("must", [])]


def score(slug: str, title: Optional[str], description: Optional[str]) -> int:
    """Cuánto encaja un anuncio con la búsqueda (0 = nada). El título pesa más que la descripción."""
    if not _PATTERNS:
        _compile()
    t, d = normalize(title), normalize(description)
    both = f"{t} {d}"
    for group in _MUST.get(slug, []):
        if not any(p.search(both) for p in group):
            return 0
    total = 0
    for weight, pattern in _PATTERNS.get(slug, []):
        if pattern.search(t):
            total += weight * 3
        elif pattern.search(d):
            total += weight
    return total


def title_for(item: dict) -> str:
    return f"{item['name']} en venta: segunda mano y nuevos | VentaCofrade"


def description_for(item: dict) -> str:
    text = item["intro"][0]
    return text if len(text) <= 155 else text[:154].rsplit(" ", 1)[0] + "…"


# ---------------------------------------------------------------------------
# Datos de una página: anuncios que coinciden y relacionados
# ---------------------------------------------------------------------------
MAX_SCAN = 3000      # anuncios activos más recientes que se revisan
MAX_MATCHES = 60     # anuncios que coinciden que se muestran
MIN_FILL = 12        # si hay menos coincidencias, se completa con relacionados hasta aquí


async def build_landing(db, slug: str) -> Optional[dict]:
    """Devuelve {landing, matches, related, related_landings} o None si la búsqueda no existe."""
    from sqlalchemy import select

    from models.categories import Categories
    from models.products import Products

    item = LANDINGS_BY_SLUG.get(slug)
    if not item:
        return None

    categories = list((await db.execute(select(Categories))).scalars().all())
    category = next((c for c in categories if c.slug == item.get("category")), None)

    products = list(
        (
            await db.execute(
                select(Products)
                .where(Products.status == "active")
                .order_by(Products.created_at.desc())
                .limit(MAX_SCAN)
            )
        ).scalars().all()
    )

    scored = [(score(slug, p.title, p.description), p) for p in products]
    matches = [p for s, p in sorted(
        ((s, p) for s, p in scored if s > 0),
        key=lambda sp: (-sp[0], -(sp[1].created_at.timestamp() if sp[1].created_at else 0)),
    )][:MAX_MATCHES]

    # Si hay pocas coincidencias, se enseña "lo que hay": primero de su categoría, luego lo más reciente.
    related: list = []
    if len(matches) < MIN_FILL:
        seen = {p.id for p in matches}
        pool = [p for p in products if category and p.category_id == category.id and p.id not in seen]
        pool += [p for p in products if p.id not in seen and p not in pool]
        related = pool[: MIN_FILL - len(matches) + 6]

    related_slugs = [s for s in item.get("related", []) if s in LANDINGS_BY_SLUG]
    children = [i for i in LANDINGS if i.get("parent") == slug]
    return {
        "landing": item,
        "category": category,
        "matches": matches,
        "related": related,
        "related_landings": [LANDINGS_BY_SLUG[s] for s in related_slugs],
        "children": children,
        # Una búsqueda concreta sin ningún anuncio no se ofrece a Google (evita páginas vacías repetidas).
        "indexable": not item.get("parent") or bool(matches),
    }


async def indexable_slugs(db) -> list[str]:
    """Búsquedas que van al sitemap: todas las generales y las concretas que tienen anuncios."""
    from sqlalchemy import select

    from models.products import Products

    rows = (
        await db.execute(
            select(Products.title, Products.description)
            .where(Products.status == "active")
            .order_by(Products.created_at.desc())
            .limit(MAX_SCAN)
        )
    ).all()
    result = []
    for item in LANDINGS:
        if not item.get("parent") or any(score(item["slug"], t, d) for t, d in rows):
            result.append(item["slug"])
    return result
