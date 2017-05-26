//Recipe TYPE	May be one of “Extract”, “Partial Mash” or “All Grain”
const recipeTypes = {
  extract: 'Extract',
  partialMash: 'Partial Mash',
  allGrain: 'All Grain',
}

//Fermentable TYPE May be "Grain", "Sugar", "Extract", "Dry Extract" or "Adjunct".  Extract refers to liquid extract.
const fermentableTypes = {
  grain: 'Grain',
  sugar: 'Sugar',
  extract: 'Extract',
  dryExtract: 'Dry Extract',
  adjunct: 'Adjunct',
}

const kilosToOunces = k => {
  return k * 35.2739619
}

const kilosToPoundes = k => {
  return kilosToOunces(k) / 16
}

const litersToOunces = l => {
  return l / 0.0295735
}

const litersToGallons = l => {
  return litersToOunces(l) / 128
}

const celsiusToFahrenheit = c => {
  return c * 1.8 + 32
}

const options = () => {
  const stepingEfficiency = 0.15
  const ajustFGforMashTemperature = true
  //slope of FG attenutation Adjustment
  const slopeOfFGAA = -1.25
  //center Mash Temp for FG Adjust
  const centerMashTempForFGAA = 153.5
  return {
    stepingEfficiency,
    ajustFGforMashTemperature,
    slopeOfFGAA,
    centerMashTempForFGAA,
  }
}

//Sugar provides 46 gravity points per pound, per gallon (PPPG).
//1 pound = 16 oz (weight/mass)
//1 gallon = 128 fl oz
//yield and efficiency should be parsed from recipe as percent values

export const estimateOG = ({ recipe, batchSize, afterBoil, includeSugars }) => {
  if (typeof recipe === 'undefined' || recipe === null) return 1.00

  batchSize = litersToGallons(batchSize)
  if (recipe.type == recipeTypes.extract) {
    //TODO
    //batchSize + TrubLoss size
  }

  let originalGravity = 0
  recipe.fermentables.map(fermentable => {
    if (fermentable.addAfterBoil && !afterBoil) return
    if (!includeSugars && fermentable.type == fermentableTypes.sugar) return

    if (
      fermentable.type === fermentableTypes.extract ||
      fermentable.type === fermentableTypes.sugar ||
      fermentable.type === fermentableTypes.dryExtract
    ) {
      originalGravity +=
        46.0 * fermentable.yield * kilosToPoundes(fermentable.amount)
    } else {
      if (recipe.type === recipeTypes.extract) {
        originalGravity +=
          46.0 *
          fermentable.yield *
          kilosToPoundes(fermentable.amount) *
          options().stepingEfficiency
      } else {
        originalGravity +=
          46.0 *
          fermentable.yield *
          kilosToPoundes(fermentable.amount) *
          recipe.efficiency
      }
    }
  })

  if (batchSize > 0.0) {
    originalGravity = 1.0 + originalGravity / batchSize / 1000.0
  } else {
    originalGravity = 1.0
  }
  return originalGravity
}

const totalFGPoints = (
  recipe,
  afterBoil,
  includeSugars,
  apparentAttenutation
) => {
  let originalGravity = 0

  // Correct attenuation
  var attenutation = 1.0 - apparentAttenutation
  var sugAttenutation = -0.231 // Sugar attenuation factor

  recipe.fermentables.map(fermentable => {
    if (fermentable.addAfterBoil && !afterBoil) return
    if (!includeSugars && fermentable.type == fermentableTypes.sugar) return

    if (
      fermentable.type === fermentableTypes.extract ||
      fermentable.type === fermentableTypes.sugar ||
      fermentable.type === fermentableTypes.dryExtract
    ) {
      if (fermentable.type === fermentableTypes.sugar)
        originalGravity +=
          sugAttenutation *
          46.0 *
          fermentable.yield *
          kilosToPoundes(fermentable.amount)
      else
        originalGravity +=
          attenutation *
          46.0 *
          fermentable.yield *
          kilosToPoundes(fermentable.amount)
    } else {
      if (recipe.type === recipeTypes.extract)
        originalGravity +=
          attenutation *
          46.0 *
          fermentable.yield *
          kilosToPoundes(fermentable.amount) *
          options().stepingEfficiency
      else
        originalGravity +=
          attenutation *
          46.0 *
          fermentable.yield *
          kilosToPoundes(fermentable.amount) *
          recipe.efficiency
    }
  })
  return originalGravity
}

export const estimateFG = ({ recipe, batchSize }) => {
  let apparentAttenutation = 0.73
  let centerMashTempForFGAA = options().centerMashTempForFGAA
  //TODO if there are more than one yeast culture
  recipe.yeasts.map(yeast => {
    if (!yeast.addAfterBoil) {
      apparentAttenutation = yeast.attenuation
    }
  })

  if (
    options().ajustFGforMashTemperature && recipe.type == recipeTypes.allGrain
  ) {
    recipe.mash.mashSteps.map(step => {
      //validate step temperature
      if (
        celsiusToFahrenheit(step.stepTemp) >= 147.0 &&
        celsiusToFahrenheit(step.stepTemp) <= 159.5
      ) {
        centerMashTempForFGAA = celsiusToFahrenheit(step.stepTemp)
      }

      apparentAttenutation +=
        options().slopeOfFGAA *
        (centerMashTempForFGAA - options().centerMashTempForFGAA) /
        100
    })
  }

  if (recipe.type == recipeTypes.extract) {
    //TODO
    //batchSize + TrubLoss size
  }

  let totalFGp = totalFGPoints(recipe, true, true, apparentAttenutation)

  batchSize = litersToGallons(batchSize)

  if (batchSize > 0) totalFGp = 1.0 + totalFGp / batchSize / 1000.0
  else totalFGp = 1.0
  return totalFGp
}
