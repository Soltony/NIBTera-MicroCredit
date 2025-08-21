
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PlusCircle, Trash2, Save, History, Loader2 as Loader, Info } from 'lucide-react';
import type { Rule, ScoringParameter } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScorePreview } from '@/components/loan/score-preview';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { LoanProduct, LoanProvider } from '@/lib/types';
import { format } from 'date-fns';
import { produce } from 'immer';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '../ui/separator';


export interface ScoringHistoryItem {
    id: string;
    savedAt: Date;
    parameters: ScoringParameter[];
    appliedProducts: { name: string }[];
}

interface CustomParameterType {
    id: string;
    name: string;
}


const validateRule = (rule: Rule, weight: number): string | null => {
    if (!rule.field.trim()) {
        return 'The "Field" name cannot be empty.';
    }
    if (rule.condition === 'between') {
        const parts = rule.value?.split('-') || [];
        const min = parts[0]?.trim();
        const max = parts[1]?.trim();
        if (!min || !max) {
            return 'For the "between" condition, both a minimum and maximum value are required.';
        }
        if (isNaN(parseFloat(min)) || isNaN(parseFloat(max))) {
             return 'The "between" condition requires numeric min/max values.';
        }
         if (parseFloat(min) >= parseFloat(max)) {
            return 'The minimum value must be less than the maximum value.';
        }
    } else {
        if (!rule.value.trim()) {
            return 'The "Value" cannot be empty.';
        }
    }
    if (rule.score > weight) {
        return `The score for this rule (${rule.score}) cannot exceed the parameter's weight (${weight}).`;
    }
    return null;
}

const AVAILABLE_FIELDS = [
    { value: 'age', label: 'Age' },
    { value: 'monthlyIncome', label: 'Monthly Income' },
    { value: 'gender', label: 'Gender' },
    { value: 'educationLevel', label: 'Education Level' },
    { value: 'totalLoans', label: 'Total Loans' },
    { value: 'onTimeRepayments', label: 'On-Time Repayments' },
];


const RuleRow = ({ rule, onUpdate, onRemove, availableFields, color, maxScore }: { rule: Rule; onUpdate: (updatedRule: Rule) => void; onRemove: () => void; availableFields: {value: string; label: string}[], color?: string, maxScore?: number }) => {
    
    const [min, max] = useMemo(() => {
        const parts = (rule.value || '').split('-');
        return [parts[0] || '', parts[1] || ''];
    }, [rule.value]);

    const handleRangeChange = (part: 'min' | 'max') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const currentMin = part === 'min' ? value : min;
        const currentMax = part === 'max' ? value : max;
        onUpdate({ ...rule, value: `${currentMin}-${currentMax}` });
    }
    
    const isScoreInvalid = maxScore !== undefined && rule.score > maxScore;
    
    return (
        <div className="flex flex-col gap-2 p-2 bg-muted/50 rounded-md" style={{'--ring-color': color} as React.CSSProperties}>
            <div className="flex items-center gap-2">
                <Select value={rule.field} onValueChange={(value) => onUpdate({ ...rule, field: value })}>
                    <SelectTrigger className={cn("w-1/4 shadow-sm focus:ring-2 focus:ring-[--ring-color]", !rule.field.trim() && 'border-destructive')}>
                        <SelectValue placeholder="Select Field" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableFields.map(field => (
                            <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={rule.condition} onValueChange={(value) => onUpdate({...rule, condition: value})}>
                    <SelectTrigger className="w-1/4 shadow-sm focus:ring-2 focus:ring-[--ring-color]">
                        <SelectValue placeholder="Condition" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value=">">&gt;</SelectItem>
                        <SelectItem value="<">&lt;</SelectItem>
                        <SelectItem value=">=">&gt;=</SelectItem>
                        <SelectItem value="<=">&lt;=</SelectItem>
                        <SelectItem value="==">==</SelectItem>
                        <SelectItem value="!=">!=</SelectItem>
                        <SelectItem value="between">Between</SelectItem>
                    </SelectContent>
                </Select>

                {rule.condition === 'between' ? (
                    <div className="flex items-center gap-2 w-1/4">
                        <Input
                            placeholder="Min"
                            value={min}
                            onChange={handleRangeChange('min')}
                            className={cn("shadow-sm focus-visible:ring-2 focus-visible:ring-[--ring-color]", (!min.trim() || (!!max.trim() && parseFloat(min) >= parseFloat(max))) && 'border-destructive')}
                        />
                        <span>-</span>
                        <Input
                            placeholder="Max"
                            value={max}
                            onChange={handleRangeChange('max')}
                            className={cn("shadow-sm focus-visible:ring-2 focus-visible:ring-[--ring-color]", (!max.trim() || (!!min.trim() && parseFloat(min) >= parseFloat(max))) && 'border-destructive')}
                        />
                    </div>
                ) : (
                    <Input
                        placeholder="e.g., 30"
                        value={rule.value || ''}
                        onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                        className={cn("w-1/4 shadow-sm focus-visible:ring-2 focus-visible:ring-[--ring-color]", !rule.value.trim() && 'border-destructive')}
                    />
                )}
                
                <Input
                    type="number"
                    placeholder="Score"
                    value={rule.score}
                    onChange={(e) => onUpdate({ ...rule, score: parseInt(e.target.value) || 0 })}
                    className={cn("w-1/4 shadow-sm focus-visible:ring-2 focus-visible:ring-[--ring-color]", isScoreInvalid && 'border-destructive')}
                />
                <Button variant="ghost" size="icon" onClick={onRemove} className="hover:bg-destructive hover:text-destructive-foreground">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
             {isScoreInvalid && <p className="text-xs text-destructive px-1">{`Score cannot exceed the parameter's weight of ${maxScore}.`}</p>}
        </div>
    );
};

function RulesTab({ 
    rules,
    setRules,
    parameters,
    themeColor,
    selectedProviderId,
    allAvailableFields
} : {
    rules: Rule[],
    setRules: React.Dispatch<React.SetStateAction<Rule[]>>,
    parameters: ScoringParameter[],
    themeColor: string,
    selectedProviderId: string,
    allAvailableFields: {value: string; label: string}[]
}) {

    const handleAddRule = () => {
        if (!selectedProviderId) return;
        const newRule: Rule = {
            id: `rule-${Date.now()}`,
            providerId: selectedProviderId,
            field: '',
            condition: '>',
            value: '',
            score: 0,
        };
        setRules(prev => [...prev, newRule]);
    }

    const handleUpdateRule = (ruleId: string, updatedRule: Rule) => {
        setRules(produce(draft => {
            const ruleIndex = draft.findIndex(r => r.id === ruleId);
            if (ruleIndex !== -1) {
                draft[ruleIndex] = updatedRule;
            }
        }));
    }

    const handleRemoveRule = (ruleId: string) => {
        setRules(prev => prev.filter(r => r.id !== ruleId));
    }

    const getParamWeight = (fieldName: string) => {
        return parameters.find(p => p.name === fieldName)?.weight;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Scoring Rules</CardTitle>
                <CardDescription>Define the rules that determine the score for each parameter.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                    <Label className="w-1/4">Field</Label>
                    <Label className="w-1/4">Condition</Label>
                    <Label className="w-1/4">Value</Label>
                    <Label className="w-1/4">Score</Label>
                </div>
                {rules.map((rule) => (
                    <RuleRow
                        key={rule.id}
                        rule={rule}
                        onUpdate={(updatedRule) => handleUpdateRule(rule.id, updatedRule)}
                        onRemove={() => handleRemoveRule(rule.id)}
                        availableFields={allAvailableFields}
                        color={themeColor}
                        maxScore={getParamWeight(rule.field)}
                    />
                ))}
            </CardContent>
            <CardFooter>
                 <Button
                    variant="outline"
                    className="w-full text-white"
                    onClick={handleAddRule}
                    style={{ backgroundColor: themeColor }}
                    >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Rule
                </Button>
            </CardFooter>
        </Card>
    );
}

function ParametersTab({ 
    parameters,
    setParameters,
    themeColor,
    selectedProviderId,
    allAvailableFields,
}: { 
    parameters: ScoringParameter[],
    setParameters: React.Dispatch<React.SetStateAction<ScoringParameter[]>>,
    themeColor: string,
    selectedProviderId: string,
    allAvailableFields: {value: string; label: string}[]
}) {
    
    const handleAddParameter = () => {
        if (!selectedProviderId) return;
        const newParam: ScoringParameter = {
            id: `param-${Date.now()}`,
            providerId: selectedProviderId,
            name: '',
            weight: 10,
        };
        setParameters(prev => [...prev, newParam]);
    };

    const handleUpdateParameter = (paramId: string, field: keyof ScoringParameter, value: any) => {
        setParameters(produce(draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                (param as any)[field] = value;
            }
        }));
    };

    const handleRemoveParameter = (paramId: string) => {
        setParameters(prev => prev.filter(p => p.id !== paramId));
    };

    const totalWeight = useMemo(() => {
        return parameters.reduce((sum, param) => sum + Number(param.weight || 0), 0);
    }, [parameters]);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Parameters & Weights</CardTitle>
                <CardDescription>
                    Define the fields to be scored and their maximum weight. The sum of all weights should be 100.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                    <Label className="w-3/4">Parameter (Field)</Label>
                    <Label className="w-1/4">Weight</Label>
                </div>
                 {parameters.map(param => (
                    <div key={param.id} className="flex items-center gap-2">
                        <Select value={param.name} onValueChange={(value) => handleUpdateParameter(param.id, 'name', value)}>
                            <SelectTrigger className="w-3/4 shadow-sm focus:ring-2 focus:ring-[--ring-color]">
                                <SelectValue placeholder="Select Parameter Field" />
                            </SelectTrigger>
                            <SelectContent>
                                {allAvailableFields.map(field => (
                                    <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            type="number"
                            value={param.weight}
                            onChange={(e) => handleUpdateParameter(param.id, 'weight', parseInt(e.target.value) || 0)}
                            className="w-1/4"
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveParameter(param.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                ))}
            </CardContent>
             <CardFooter className="flex flex-col items-stretch gap-4">
                 <Button
                    variant="outline"
                    className="w-full text-white"
                    onClick={handleAddParameter}
                    style={{ backgroundColor: themeColor }}
                    >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Parameter
                </Button>
                <Separator />
                <div className="flex justify-end items-baseline gap-4">
                    <span className="text-sm text-muted-foreground">Total Weight</span>
                    <span className={cn("text-2xl font-bold", totalWeight !== 100 && 'text-destructive')}>
                        {totalWeight} / 100
                    </span>
                </div>
                {totalWeight !== 100 && <p className="text-xs text-destructive text-right">The sum of all parameter weights must equal 100.</p>}
            </CardFooter>
        </Card>
    );
}


interface CreditScoreEngineClientProps {
    providers: LoanProvider[];
    initialScoringParameters: ScoringParameter[];
    initialScoringRules: Rule[];
    initialHistory: ScoringHistoryItem[];
}

export function CreditScoreEngineClient({ providers: initialProviders, initialScoringParameters, initialScoringRules, initialHistory }: CreditScoreEngineClientProps) {
    const [providers, setProviders] = useState(initialProviders);
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    
    // Global state for all params and rules
    const [allParameters, setAllParameters] = useState<ScoringParameter[]>(initialScoringParameters);
    const [allRules, setAllRules] = useState<Rule[]>(initialScoringRules);
    
    const [customParams, setCustomParams] = useState<CustomParameterType[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (providers.length > 0 && !selectedProviderId) {
            setSelectedProviderId(providers[0].id);
        }
    }, [providers, selectedProviderId]);
    
    useEffect(() => {
        const fetchProviderData = async () => {
            if (!selectedProviderId) return;
            setIsLoading(true);
            try {
                const customParamsResponse = await fetch(`/api/settings/custom-parameters?providerId=${selectedProviderId}`);
                if (!customParamsResponse.ok) throw new Error('Failed to fetch custom parameters');
                const customParamsData = await customParamsResponse.json();
                setCustomParams(customParamsData);

            } catch (error) {
                toast({ title: "Error", description: "Could not fetch configuration data.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchProviderData();
    }, [selectedProviderId, toast]);

    const themeColor = useMemo(() => providers.find(p => p.id === selectedProviderId)?.colorHex || '#fdb913', [providers, selectedProviderId]);

    // Memoized filters for the currently selected provider
    const currentParameters = useMemo(() => allParameters.filter(p => p.providerId === selectedProviderId), [allParameters, selectedProviderId]);
    const currentRules = useMemo(() => allRules.filter(r => r.providerId === selectedProviderId), [allRules, selectedProviderId]);
    
    // Memoized setter functions for the current provider
    const setCurrentParameters = (updater: React.SetStateAction<ScoringParameter[]>) => {
        setAllParameters(prevAll => {
            const otherProviderParams = prevAll.filter(p => p.providerId !== selectedProviderId);
            const currentProviderParams = prevAll.filter(p => p.providerId === selectedProviderId);
            const updated = typeof updater === 'function' ? updater(currentProviderParams) : updater;
            return [...otherProviderParams, ...updated];
        });
    };
    const setCurrentRules = (updater: React.SetStateAction<Rule[]>) => {
        setAllRules(prevAll => {
            const otherProviderRules = prevAll.filter(p => p.providerId !== selectedProviderId);
            const currentProviderRules = prevAll.filter(p => p.providerId === selectedProviderId);
            const updated = typeof updater === 'function' ? updater(currentProviderRules) : updater;
            return [...otherProviderRules, ...updated];
        });
    };
    
    const allAvailableFields = useMemo(() => {
        const customFields = customParams.map(p => ({ value: p.name, label: p.name }));
        return [...AVAILABLE_FIELDS, ...customFields];
    }, [customParams]);

    const handleSave = async () => {
        if (!selectedProviderId) return;

        const totalWeight = currentParameters.reduce((sum, param) => sum + Number(param.weight || 0), 0);
        if (totalWeight !== 100) {
            toast({
                title: 'Invalid Configuration',
                description: 'The sum of all parameter weights must be exactly 100.',
                variant: 'destructive',
            });
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/scoring-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    providerId: selectedProviderId, 
                    parameters: currentParameters,
                    rules: currentRules,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save configuration.');
            }

            const { savedParameters, savedRules } = await response.json();
            
            setAllParameters(prev => [...prev.filter(p => p.providerId !== selectedProviderId), ...savedParameters]);
            setAllRules(prev => [...prev.filter(r => r.providerId !== selectedProviderId), ...savedRules]);
            
            toast({
                title: 'Configuration Saved',
                description: 'Your credit scoring engine has been successfully saved.',
            });

        } catch (error: any) {
             toast({
                title: 'Error Saving',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    }


    if (providers.length === 0) {
        return (
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h2 className="text-3xl font-bold tracking-tight">Credit Scoring Engine</h2>
                <div className="flex items-center justify-center h-64">
                    <Loader className="h-8 w-8 animate-spin" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Credit Scoring Engine</h2>
                    <p className="text-muted-foreground">
                        Define the parameters and rules used to calculate customer credit scores.
                    </p>
                </div>
                 <div className="flex items-center space-x-4">
                     <Select onValueChange={setSelectedProviderId} value={selectedProviderId}>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                        <SelectContent>
                            {providers.map(provider => (
                                <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            <div className="flex items-center justify-end">
                <Button onClick={handleSave} style={{ backgroundColor: themeColor }} className="text-white" disabled={isLoading}>
                    {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Configuration
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <ParametersTab
                    parameters={currentParameters}
                    setParameters={setCurrentParameters}
                    themeColor={themeColor}
                    selectedProviderId={selectedProviderId}
                    allAvailableFields={allAvailableFields}
                />
                <RulesTab
                    rules={currentRules}
                    setRules={setCurrentRules}
                    parameters={currentParameters}
                    themeColor={themeColor}
                    selectedProviderId={selectedProviderId}
                    allAvailableFields={allAvailableFields}
                />
            </div>

            <ScorePreview parameters={currentParameters} rules={currentRules} availableFields={allAvailableFields} providerColor={themeColor} />
        </div>
    );
}
