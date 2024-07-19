export const calculateROI = (inputs, timeHorizon) => {
  const {
    maintenanceType,
    outsourcingCost,
    avgPay,
    totalAcres,
    timePerMow,
    mowFrequency,
    mowingWeeks,
    fuelPrice,
    plan,
    knoxbotsCost,
    knoxbotsSubscriptionCost,
    roboticMowerEquipmentCost,
    selectedMowers,
    equipmentPurchaseCycle,
    lastPurchaseYear,
    equipmentPurchaseMethod,
    golfInputs,
    isGolfCourse,
    assumptions,
    discountFeature,
  } = inputs;

  const {
    benefitsPercentage,
    fuelPriceIncrease,
    laborCostIncrease,
    traditionalMaintenancePercentage,
    knoxbotsMaintenancePercentage,
    knoxbotsLaborPercentage,
  } = assumptions;

  const currentYear = new Date().getFullYear();
  const yearsSinceLastPurchase = currentYear - lastPurchaseYear;

  // Calculate installation fee based on total acres
  let installationFee = 0;
  if (totalAcres <= 5) {
    installationFee = 800 * totalAcres;
  } else if (totalAcres <= 25) {
    installationFee = 700 * totalAcres;
  } else {
    installationFee = 600 * totalAcres;
  }

  // Function to calculate annual labor cost for traditional maintenance
  const calculateAnnualLaborCost = (basePayRate, year) => {
    const payRate = basePayRate * Math.pow(1 + laborCostIncrease / 100, year);
    return (
      payRate *
      totalAcres *
      mowFrequency *
      timePerMow *
      mowingWeeks *
      (1 + benefitsPercentage / 100)
    );
  };

  const initialAnnualLaborCost = calculateAnnualLaborCost(avgPay, 0);

  // Function to calculate annual fuel cost
  const calculateAnnualFuelCost = (baseFuelPrice, year) => {
    const fuelPriceForYear =
      baseFuelPrice * Math.pow(1 + fuelPriceIncrease / 100, year);
    return fuelPriceForYear * totalAcres * mowFrequency * mowingWeeks;
  };

  const initialAnnualFuelCost = calculateAnnualFuelCost(fuelPrice, 0);

  // Calculate total equipment cost
  const totalEquipmentCost = selectedMowers.reduce(
    (sum, mower) => sum + mower.cost * mower.quantity,
    0,
  );

  // Calculate equipment cost based on purchase cycle
  const calculateEquipmentCost = (cycleYear) => {
    if (equipmentPurchaseMethod === "upfront" && cycleYear === 0) {
      return totalEquipmentCost;
    } else if (equipmentPurchaseMethod === "amortized") {
      return totalEquipmentCost / equipmentPurchaseCycle;
    }
    return 0;
  };

  const annualEquipmentCost = calculateEquipmentCost(0);
  const traditionalMaintenanceCost =
    totalEquipmentCost * (traditionalMaintenancePercentage / 100);
  const knoxbotsMaintenanceCost =
    roboticMowerEquipmentCost * (knoxbotsMaintenancePercentage / 100);

  // Calculate labor cost for KnoxBots
  const knoxbotsLaborCost =
    avgPay *
    totalAcres *
    mowFrequency *
    timePerMow *
    mowingWeeks *
    (knoxbotsLaborPercentage / 100);

  // Calculate annual costs for traditional and KnoxBots maintenance
  const traditionalAnnualCost =
    maintenanceType === "outsourcing"
      ? outsourcingCost * 12
      : initialAnnualLaborCost +
        initialAnnualFuelCost +
        annualEquipmentCost +
        traditionalMaintenanceCost;

  const calculateKnoxbotsCost = (year) => {
    if (plan === "MaintainME") {
      const equipmentRepurchaseYear = Math.floor(year / 4) * 4;
      return (
        knoxbotsSubscriptionCost * totalAcres * 12 +
        (year === equipmentRepurchaseYear ? roboticMowerEquipmentCost : 0) +
        knoxbotsMaintenanceCost +
        knoxbotsLaborCost
      );
    } else {
      const monthlyCost =
        discountFeature && year % 12 >= 8 && year % 12 < 12
          ? knoxbotsCost * totalAcres * 0.5
          : knoxbotsCost * totalAcres;
      return monthlyCost * 12 + knoxbotsLaborCost;
    }
  };

  const knoxbotsAnnualCost = calculateKnoxbotsCost(0);

  let cumulativeSavings = 0;
  const fiveYearProjection = Array.from({ length: timeHorizon }, (_, i) => {
    const year = currentYear + i;
    const cycleYear = (year - lastPurchaseYear) % equipmentPurchaseCycle;

    const yearLaborCost = calculateAnnualLaborCost(avgPay, i);
    const yearFuelCost = calculateAnnualFuelCost(fuelPrice, i);
    const yearEquipmentCost = calculateEquipmentCost(cycleYear);
    const yearTraditionalCost =
      maintenanceType === "outsourcing"
        ? outsourcingCost * 12 * Math.pow(1 + laborCostIncrease / 100, i)
        : yearLaborCost +
          yearFuelCost +
          traditionalMaintenanceCost +
          yearEquipmentCost;

    const yearKnoxbotsCost =
      calculateKnoxbotsCost(i) + (i === 0 ? installationFee : 0);

    const yearSavings = yearTraditionalCost - yearKnoxbotsCost;
    cumulativeSavings += yearSavings;

    return {
      year: i + 1,
      traditional: yearTraditionalCost,
      knoxbots: yearKnoxbotsCost,
      savings: yearSavings,
      cumulativeSavings: cumulativeSavings,
      traditionalBreakdown: {
        labor: yearLaborCost * (1 - benefitsPercentage / 100),
        benefits: yearLaborCost * (benefitsPercentage / 100),
        fuel: yearFuelCost,
        maintenance: traditionalMaintenanceCost,
        equipment: yearEquipmentCost,
      },
      knoxbotsBreakdown: {
        labor: knoxbotsLaborCost,
        installation: i === 0 ? installationFee : 0,
        equipment:
          plan === "MaintainME" && i % 4 === 0 ? roboticMowerEquipmentCost : 0,
        subscription:
          plan === "SYNC"
            ? discountFeature && i % 12 >= 8 && i % 12 < 12
              ? knoxbotsCost * totalAcres * 0.5 * 12
              : knoxbotsCost * totalAcres * 12
            : knoxbotsSubscriptionCost * totalAcres * 12,
        maintenance: knoxbotsMaintenanceCost,
      },
    };
  });

  const totalTraditionalCost = fiveYearProjection.reduce(
    (sum, year) => sum + year.traditional,
    0,
  );
  const totalKnoxbotsCost = fiveYearProjection.reduce(
    (sum, year) => sum + year.knoxbots,
    0,
  );
  const totalSavings = totalTraditionalCost - totalKnoxbotsCost;

  const averageTraditionalAnnualCost = totalTraditionalCost / timeHorizon;
  const averageKnoxbotsAnnualCost = totalKnoxbotsCost / timeHorizon;
  const averageAnnualSavings = totalSavings / timeHorizon;

  // Calculate ROI as a percentage of savings over the total traditional cost
  const roi = (totalSavings / totalTraditionalCost) * 100;

  return {
    averageTraditionalAnnualCost,
    averageKnoxbotsAnnualCost,
    averageAnnualSavings,
    roi,
    timeHorizon,
    fiveYearProjection,
    installationFee,
  };
};
