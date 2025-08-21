
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
import { PlusCircle, Trash2, Save, History, Loader2 as Loader, Info, GripVertical } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScorePreview } from '@/components/loan/score-preview';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { LoanProduct, LoanProvider } from '@/lib/types';
import { format } from 'date-fns';
import { produce } from 'immer';
import { cn } from '@/lib/utils';
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

const AVAILABLE_FIELDS = [
    { value: 'age', label: 'Age' },
    { value: 'monthlyIncome', label: 'Monthly Income' },
    { value: 'gender', label: 'Gender' },
    { value: 'educationLevel', label: 'Education Level' },
    { value: 'totalLoans', label: 'Total Loans' },
    { value: 'onTimeRepayments', label: 'On-Time Repayments' },
];


const RuleRow = ({ rule, onUpdate, onRemove, color, maxScore }: { rule: Rule; onUpdate: (updatedRule: Rule) => void; onRemove: () => void; color?: string, maxScore: number }) => {
    
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
                <Select value={rule.condition} onValueChange={(value) => onUpdate({...rule, condition: value})}>
                    <SelectTrigger className="w-[150px] shadow-sm focus:ring-2 focus:ring-[--ring-color]">
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
                    <div className="flex items-center gap-2 flex-1">
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
                        placeholder="e.g., 30 or High School"
                        value={rule.value || ''}
                        onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                        className={cn("flex-1 shadow-sm focus-visible:ring-2 focus-visible:ring-[--ring-color]", !rule.value.trim() && 'border-destructive')}
                    />
                )}
                
                <Input
                    type="number"
                    placeholder="Score"
                    value={rule.score}
                    onChange={(e) => onUpdate({ ...rule, score: parseInt(e.target.value) || 0 })}
                    className={cn("w-[100px] shadow-sm focus-visible:ring-2 focus-visible:ring-[--ring-color]", isScoreInvalid && 'border-destructive')}
                />
                <Button variant="ghost" size="icon" onClick={onRemove} className="hover:bg-destructive hover:text-destructive-foreground">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
             {isScoreInvalid && <p className="text-xs text-destructive px-1">{`Score cannot exceed the parameter's weight of ${maxScore}.`}</p>}
        </div>
    );
};


interface CreditScoreEngineClientProps {
    providers: LoanProvider[];
    initialScoringParameters: ScoringParameter[];
}

export function CreditScoreEngineClient({ providers: initialProviders, initialScoringParameters }: CreditScoreEngineClientProps) {
    const [providers, setProviders] = useState(initialProviders);
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    
    // Global state for all params
    const [allParameters, setAllParameters] = useState<ScoringParameter[]>(initialScoringParameters);
    
    const [customParams, setCustomParams] = useState<CustomParameterType[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [scoringHistory, setScoringHistory] = useState<ScoringHistoryItem[]>([]);
    const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState<Record<string, boolean>>({});

    const { toast } = useToast();

    useEffect(() => {
        if (providers.length > 0 && !selectedProviderId) {
            setSelectedProviderId(providers[0].id);
        }
    }, [providers, selectedProviderId]);
    
    useEffect(() => {
        const fetchProviderData = async () => {
            if (!selectedProviderId) return;
            setIsSaving(true);
            setIsHistoryLoading(true);
            try {
                const [customParamsResponse, historyResponse] = await Promise.all([
                    fetch(`/api/settings/custom-parameters?providerId=${selectedProviderId}`),
                    fetch(`/api/scoring-history?providerId=${selectedProviderId}`)
                ]);

                if (!customParamsResponse.ok) throw new Error('Failed to fetch custom parameters');
                const customParamsData = await customParamsResponse.json();
                setCustomParams(customParamsData);

                if (!historyResponse.ok) throw new Error('Failed to fetch scoring history');
                const historyData = await historyResponse.json();
                setScoringHistory(historyData);

            } catch (error) {
                toast({ title: "Error", description: "Could not fetch configuration data.", variant: "destructive" });
            } finally {
                setIsSaving(false);
                setIsHistoryLoading(false);
            }
        };
        fetchProviderData();
    }, [selectedProviderId, toast]);

    const themeColor = useMemo(() => providers.find(p => p.id === selectedProviderId)?.colorHex || '#fdb913', [providers, selectedProviderId]);

    // Memoized filters for the currently selected provider
    const currentParameters = useMemo(() => allParameters.filter(p => p.providerId === selectedProviderId), [allParameters, selectedProviderId]);
    
    // Memoized setter function for the current provider
    const setCurrentParameters = (updater: React.SetStateAction<ScoringParameter[]>) => {
        setAllParameters(prevAll => {
            const otherProviderParams = prevAll.filter(p => p.providerId !== selectedProviderId);
            const currentProviderParams = prevAll.filter(p => p.providerId === selectedProviderId);
            const updated = typeof updater === 'function' ? updater(currentProviderParams) : updater;
            return [...otherProviderParams, ...updated];
        });
    };
    
    const allAvailableFields = useMemo(() => {
        const customFields = customParams.map(p => ({ value: p.name, label: p.name }));
        return [...AVAILABLE_FIELDS, ...customFields];
    }, [customParams]);
    
    const handleAddParameter = () => {
        if (!selectedProviderId) return;
        const newParam: ScoringParameter = {
            id: `param-${Date.now()}`,
            providerId: selectedProviderId,
            name: '',
            weight: 10,
            rules: [],
        };
        setCurrentParameters(prev => [...prev, newParam]);
    };
    
    const handleUpdateParameter = (paramId: string, field: 'name' | 'weight', value: any) => {
        setCurrentParameters(produce(draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                (param as any)[field] = value;
            }
        }));
    };
    
    const handleRemoveParameter = (paramId: string) => {
        setCurrentParameters(prev => prev.filter(p => p.id !== paramId));
    };

    const handleAddRule = (paramId: string) => {
        setCurrentParameters(produce(draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                const newRule: Rule = {
                    id: `rule-${Date.now()}`,
                    parameterId: param.id,
                    field: param.name, // Default rule field to parameter name
                    condition: '>',
                    value: '',
                    score: 0,
                };
                if (!param.rules) param.rules = [];
                param.rules.push(newRule);
            }
        }))
    }

    const handleUpdateRule = (paramId: string, ruleId: string, updatedRule: Rule) => {
        setCurrentParameters(produce(draft => {
            const param = draft.find(p => p.id === paramId);
            if (param && param.rules) {
                const ruleIndex = param.rules.findIndex(r => r.id === ruleId);
                if (ruleIndex !== -1) {
                    param.rules[ruleIndex] = updatedRule;
                }
            }
        }));
    };

    const handleRemoveRule = (paramId: string, ruleId: string) => {
        setCurrentParameters(produce(draft => {
            const param = draft.find(p => p.id === paramId);
            if (param && param.rules) {
                param.rules = param.rules.filter(r => r.id !== ruleId);
            }
        }));
    };

    const totalWeight = useMemo(() => {
        return currentParameters.reduce((sum, param) => sum + Number(param.weight || 0), 0);
    }, [currentParameters]);

    const handleOpenSaveDialog = () => {
        if (totalWeight !== 100) {
             toast({
                title: 'Invalid Configuration',
                description: 'The sum of all parameter weights must be exactly 100.',
                variant: 'destructive',
            });
            return;
        }
        setIsApplyDialogOpen(true);
    };

    const handleSaveAndApply = async () => {
        if (!selectedProviderId) return;
        
        const appliedProductIds = Object.entries(selectedProducts)
            .filter(([, isSelected]) => isSelected)
            .map(([productId]) => productId);

        if (appliedProductIds.length === 0) {
            toast({
                title: 'No Products Selected',
                description: 'Please select at least one product to apply this configuration to.',
                variant: 'destructive'
            });
            return;
        }

        setIsSaving(true);
        try {
            // Step 1: Save the rules
            const rulesResponse = await fetch('/api/scoring-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    providerId: selectedProviderId, 
                    parameters: currentParameters,
                }),
            });
            if (!rulesResponse.ok) throw new Error((await rulesResponse.json()).error || 'Failed to save rules.');
            const savedParameters = await rulesResponse.json();
            
            // Step 2: Save history record
            const historyResponse = await fetch('/api/scoring-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    providerId: selectedProviderId,
                    parameters: savedParameters,
                    appliedProductIds,
                })
            });
             if (!historyResponse.ok) throw new Error((await historyResponse.json()).error || 'Failed to save history.');
            const newHistoryItem = await historyResponse.json();
            
            // Update client state
            setAllParameters(prev => [...prev.filter(p => p.providerId !== selectedProviderId), ...savedParameters]);
            setScoringHistory(prev => [newHistoryItem, ...prev]);
            
            toast({
                title: 'Configuration Saved & Applied',
                description: `Rules have been applied to ${appliedProductIds.length} product(s).`,
            });

        } catch (error: any) {
             toast({
                title: 'Error Saving',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
            setIsApplyDialogOpen(false);
            setSelectedProducts({});
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
    
    const currentProvider = providers.find(p => p.id === selectedProviderId);

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Credit Scoring Engine</h2>
                    <p className="text-muted-foreground">
                        Define the parameters, weights, and rules used to calculate customer credit scores.
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
            
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Parameters & Rules</CardTitle>
                        <CardDescription>
                            Define parameters, their weights, and the rules that assign scores.
                        </CardDescription>
                    </div>
                     <Button onClick={handleOpenSaveDialog} style={{ backgroundColor: themeColor }} className="text-white" disabled={isSaving}>
                        {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Configuration
                    </Button>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" className="w-full space-y-2">
                        {currentParameters.map((param) => (
                             <AccordionItem value={param.id} key={param.id} className="border-none">
                                <Card className="overflow-hidden">
                                     <AccordionTrigger className="w-full p-0 hover:no-underline">
                                        <div className="flex items-center p-4 bg-muted/50">
                                            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab"/>
                                            <div className="flex-1 grid grid-cols-2 gap-4 items-center ml-4" onClick={(e) => e.stopPropagation()}>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`param-name-${param.id}`}>Parameter</Label>
                                                    <Select value={param.name} onValueChange={(value) => handleUpdateParameter(param.id, 'name', value)}>
                                                        <SelectTrigger id={`param-name-${param.id}`} className="w-full bg-background shadow-sm focus:ring-2 focus:ring-[--ring-color]" style={{'--ring-color': themeColor} as React.CSSProperties}>
                                                            <SelectValue placeholder="Select Parameter Field" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {allAvailableFields.map(field => (
                                                                <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                    <div className="space-y-1">
                                                    <Label htmlFor={`param-weight-${param.id}`}>Weight</Label>
                                                    <Input
                                                        id={`param-weight-${param.id}`}
                                                        type="number"
                                                        value={param.weight}
                                                        onChange={(e) => handleUpdateParameter(param.id, 'weight', parseInt(e.target.value) || 0)}
                                                        className="w-full bg-background"
                                                    />
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="ml-4" onClick={(e) => { e.stopPropagation(); handleRemoveParameter(param.id)}}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            <div className="p-2 ml-2">
                                                <span className="sr-only">Toggle</span>
                                            </div>
                                        </div>
                                     </AccordionTrigger>
                                     <AccordionContent className="p-4">
                                        <div className="space-y-2">
                                            {(param.rules || []).map(rule => (
                                                <RuleRow 
                                                    key={rule.id}
                                                    rule={rule}
                                                    onUpdate={(updatedRule) => handleUpdateRule(param.id, rule.id, updatedRule)}
                                                    onRemove={() => handleRemoveRule(param.id, rule.id)}
                                                    color={themeColor}
                                                    maxScore={param.weight}
                                                />
                                            ))}
                                            <Button variant="outline" className="w-full mt-2" onClick={() => handleAddRule(param.id)}>
                                                <PlusCircle className="mr-2 h-4 w-4" /> Add Rule
                                            </Button>
                                        </div>
                                     </AccordionContent>
                                </Card>
                             </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
                <CardFooter className="flex flex-col items-stretch gap-4">
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleAddParameter}
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

            <ScorePreview parameters={currentParameters} availableFields={allAvailableFields} providerColor={themeColor} />
            
             <Card>
                <CardHeader>
                    <CardTitle>Configuration History</CardTitle>
                    <CardDescription>View past scoring configurations for this provider.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isHistoryLoading ? <div className="text-center p-8"><Loader className="h-6 w-6 animate-spin mx-auto"/></div> :
                    scoringHistory.length > 0 ? (
                        <ul className="space-y-4">
                        {scoringHistory.map(item => (
                            <li key={item.id} className="p-4 border rounded-md">
                                <p className="font-semibold">{format(new Date(item.savedAt), 'MMMM d, yyyy h:mm a')}</p>
                                <p className="text-sm text-muted-foreground">Applied to: <span className="font-medium text-foreground">{item.appliedProducts.map(p => p.name).join(', ') || 'N/A'}</span></p>
                            </li>
                        ))}
                        </ul>
                    ) : <p className="text-sm text-muted-foreground text-center p-8">No history found.</p>
                    }
                </CardContent>
            </Card>

            <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Apply Configuration to Products</DialogTitle>
                        <DialogDescription>
                            Select the loan products you want to apply this new scoring configuration to. This will be saved as a new version in the history.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        {currentProvider?.products.map(product => (
                             <div key={product.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`product-${product.id}`}
                                    checked={selectedProducts[product.id] || false}
                                    onCheckedChange={(checked) =>
                                        setSelectedProducts(prev => ({...prev, [product.id]: !!checked}))
                                    }
                                />
                                <Label htmlFor={`product-${product.id}`}>{product.name}</Label>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleSaveAndApply} style={{backgroundColor: themeColor}} className="text-white" disabled={isSaving}>
                             {isSaving && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                             Save and Apply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
